// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @notice Exactly as in SHARED_CONTRACTS.md section A. Do not rename.
interface IPolicyVault {
    event SupplierSet(address indexed supplier, address payToken, bool allowed);
    event PaymentExecuted(
        bytes32 indexed invoiceId, address indexed supplier, address payToken, uint256 amountIn, uint256 amountOut
    );
    event PaymentRejected(bytes32 indexed invoiceId, address indexed supplier, string reason);

    function setSupplier(address supplier, address payToken, bool allowed) external; // owner only
    function setLimits(uint256 perPaymentCap, uint256 dailyCap) external; // owner only, in ARGt (18 decimals)
    function setAgent(address agent) external; // owner only
    function pay(bytes32 invoiceId, address supplier, uint256 amountInARGt, uint256 minAmountOut) external; // agent only
    function isAllowed(address supplier) external view returns (bool);
    function spentToday() external view returns (uint256);
}
