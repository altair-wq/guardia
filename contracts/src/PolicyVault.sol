// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Ownable, Ownable2Step} from "@openzeppelin/contracts/access/Ownable2Step.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {Pausable} from "@openzeppelin/contracts/utils/Pausable.sol";
import {IPolicyVault} from "./IPolicyVault.sol";

/// @notice Minimal view of the Twin Curve pools on Arbitrum (twocrypto-ng, uint256 coin indices).
interface ICurvePool {
    function coins(uint256 i) external view returns (address);
    function exchange(uint256 i, uint256 j, uint256 dx, uint256 minDy, address receiver) external returns (uint256);
}

/// @title PolicyVault
/// @notice Holds a company's ARGt and pays allowlisted suppliers on behalf of an AI agent.
///         The owner's rules live here, so even a fooled agent cannot move money outside them.
contract PolicyVault is IPolicyVault, Ownable2Step, ReentrancyGuard, Pausable {
    using SafeERC20 for IERC20;

    IERC20 public immutable ARGT;
    IERC20 public immutable BRAT;
    IERC20 public immutable USDT0;
    ICurvePool public immutable ARGT_POOL; // ARGt/USDT0
    ICurvePool public immutable BRAT_POOL; // BRAt/USDT0
    uint256 internal immutable ARGT_IDX; // ARGt index in ARGT_POOL
    uint256 internal immutable USDT_IDX_A; // USDT0 index in ARGT_POOL
    uint256 internal immutable USDT_IDX_B; // USDT0 index in BRAT_POOL
    uint256 internal immutable BRAT_IDX; // BRAt index in BRAT_POOL

    /// @notice The only address allowed to call `pay()`.
    address public agent;
    /// @notice Max ARGt (18 decimals) a single payment may spend.
    uint256 public perPaymentCap;
    /// @notice Max ARGt (18 decimals) all executed payments may spend in one UTC day.
    uint256 public dailyCap;
    /// @notice Token each allowlisted supplier must be paid in (zero address = not allowlisted).
    mapping(address supplier => address token) public payTokenOf;
    /// @notice Invoice ids already processed (paid OR rejected); each id is single-use.
    mapping(bytes32 invoiceId => bool) public used;

    uint256 internal spentDay; // day index (block.timestamp / 1 days) of `spent`
    uint256 internal spent; // ARGt spent during `spentDay`

    event AgentSet(address indexed agent);
    event LimitsSet(uint256 perPaymentCap, uint256 dailyCap);
    event Withdrawn(address indexed token, address indexed to, uint256 amount);

    error NotAgent();
    error AlreadyPaid(bytes32 invoiceId);
    error UnsupportedToken(address token);
    error PoolMismatch();
    error SlippageExceeded(uint256 amountOut, uint256 minAmountOut);
    error ZeroAddress();
    error ZeroAmount();
    error InvalidLimits();

    modifier onlyAgent() {
        if (msg.sender != agent) revert NotAgent();
        _;
    }

    /// @dev Coin indices and USDT0 are read from the pools, never hardcoded.
    ///      Reverts unless both pools share the same USDT0.
    constructor(address owner_, address argt, address brat, address argtPool, address bratPool) Ownable(owner_) {
        if (argt == address(0) || brat == address(0) || argtPool == address(0) || bratPool == address(0)) {
            revert ZeroAddress();
        }
        (uint256 aIdx, address usdtA) = _locate(ICurvePool(argtPool), argt);
        (uint256 bIdx, address usdtB) = _locate(ICurvePool(bratPool), brat);
        if (usdtA != usdtB) revert PoolMismatch();
        ARGT = IERC20(argt);
        BRAT = IERC20(brat);
        USDT0 = IERC20(usdtA);
        ARGT_POOL = ICurvePool(argtPool);
        BRAT_POOL = ICurvePool(bratPool);
        ARGT_IDX = aIdx;
        USDT_IDX_A = 1 - aIdx;
        BRAT_IDX = bIdx;
        USDT_IDX_B = 1 - bIdx;
    }

    // ----------------------------------------------------------------- owner

    /// @notice Rule 1: only allowlisted suppliers can be paid, and only in their registered token (ARGt or BRAt).
    function setSupplier(address supplier, address payToken, bool allowed) external onlyOwner {
        if (supplier == address(0)) revert ZeroAddress();
        if (allowed) {
            if (payToken != address(ARGT) && payToken != address(BRAT)) revert UnsupportedToken(payToken);
            payTokenOf[supplier] = payToken;
        } else {
            delete payTokenOf[supplier];
        }
        emit SupplierSet(supplier, payToken, allowed);
    }

    /// @notice Rules 2 and 3: per-payment and daily caps, in ARGt (18 decimals).
    function setLimits(uint256 perPaymentCap_, uint256 dailyCap_) external onlyOwner {
        if (perPaymentCap_ > dailyCap_) revert InvalidLimits();
        perPaymentCap = perPaymentCap_;
        dailyCap = dailyCap_;
        emit LimitsSet(perPaymentCap_, dailyCap_);
    }

    /// @notice Sets the single address allowed to trigger payments.
    function setAgent(address agent_) external onlyOwner {
        agent = agent_;
        emit AgentSet(agent_);
    }

    /// @notice Kill switch: while paused, `pay()` reverts.
    function pause() external onlyOwner {
        _pause();
    }

    function unpause() external onlyOwner {
        _unpause();
    }

    /// @notice Emergency exit for any token held by the vault.
    function withdraw(address token, address to, uint256 amount) external onlyOwner {
        if (to == address(0)) revert ZeroAddress();
        IERC20(token).safeTransfer(to, amount);
        emit Withdrawn(token, to, amount);
    }

    // ----------------------------------------------------------------- agent

    /// @notice Pays an invoice if every rule passes. Rule violations do NOT revert: they emit
    ///         `PaymentRejected` and return, so there is an on-chain proof of the rejection.
    /// @param invoiceId Single-use id; reusing it reverts with `AlreadyPaid`.
    /// @param amountInARGt ARGt (18 decimals) the vault spends.
    /// @param minAmountOut Minimum amount the supplier must receive in their token (slippage guard for BRAt).
    function pay(bytes32 invoiceId, address supplier, uint256 amountInARGt, uint256 minAmountOut)
        external
        onlyAgent
        whenNotPaused
        nonReentrant
    {
        if (used[invoiceId]) revert AlreadyPaid(invoiceId);
        if (amountInARGt == 0) revert ZeroAmount();
        used[invoiceId] = true;

        address token = payTokenOf[supplier];
        if (token == address(0)) return _reject(invoiceId, supplier, "not_allowlisted");
        if (amountInARGt > perPaymentCap) return _reject(invoiceId, supplier, "over_payment_cap");
        if (spentToday() + amountInARGt > dailyCap) return _reject(invoiceId, supplier, "over_daily_cap");

        // Rule 3: only executed payments count against the daily cap.
        uint256 today = block.timestamp / 1 days;
        if (spentDay != today) {
            spentDay = today;
            spent = 0;
        }
        spent += amountInARGt;

        uint256 amountOut;
        if (token == address(ARGT)) {
            amountOut = amountInARGt;
            ARGT.safeTransfer(supplier, amountInARGt);
        } else {
            amountOut = _swapToBRAt(supplier, amountInARGt, minAmountOut);
        }
        emit PaymentExecuted(invoiceId, supplier, token, amountInARGt, amountOut);
    }

    // ----------------------------------------------------------------- views

    function isAllowed(address supplier) external view returns (bool) {
        return payTokenOf[supplier] != address(0);
    }

    /// @notice ARGt spent today (UTC day window); 0 once the day changes.
    function spentToday() public view returns (uint256) {
        return spentDay == block.timestamp / 1 days ? spent : 0;
    }

    // -------------------------------------------------------------- internal

    function _reject(bytes32 invoiceId, address supplier, string memory reason) internal {
        emit PaymentRejected(invoiceId, supplier, reason);
    }

    /// @dev ARGt -> USDT0 (ARGt pool) -> BRAt (BRAt pool, sent straight to the supplier).
    ///      Exact approvals per hop; `minAmountOut` is enforced on the final output.
    function _swapToBRAt(address supplier, uint256 amountIn, uint256 minAmountOut) internal returns (uint256 out) {
        ARGT.forceApprove(address(ARGT_POOL), amountIn);
        uint256 usdt = ARGT_POOL.exchange(ARGT_IDX, USDT_IDX_A, amountIn, 0, address(this));
        USDT0.forceApprove(address(BRAT_POOL), usdt);
        out = BRAT_POOL.exchange(USDT_IDX_B, BRAT_IDX, usdt, minAmountOut, supplier);
        if (out < minAmountOut) revert SlippageExceeded(out, minAmountOut);
    }

    /// @dev Returns `token`'s index in a 2-coin pool and the other coin (USDT0).
    function _locate(ICurvePool pool, address token) internal view returns (uint256 idx, address other) {
        address c0 = pool.coins(0);
        address c1 = pool.coins(1);
        if (c0 == token) return (0, c1);
        if (c1 == token) return (1, c0);
        revert UnsupportedToken(token);
    }
}
