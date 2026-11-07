// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {Pausable} from "@openzeppelin/contracts/utils/Pausable.sol";
import {PolicyVault, ICurvePool} from "../src/PolicyVault.sol";
import {IPolicyVault} from "../src/IPolicyVault.sol";

interface ICurveQuote {
    function get_dy(uint256 i, uint256 j, uint256 dx) external view returns (uint256);
}

/// @notice Run with: forge test --fork-url $ARBITRUM_RPC_URL
contract PolicyVaultTest is Test {
    address constant ARGT = 0x59863989d080B22476DB95656d0C3CC18be92214;
    address constant BRAT = 0xC4ed6Aba5373D78E160F4df39e011F078Be54df8;
    address constant ARGT_POOL = 0x356D349dA9ADd7Efb56a35fAB939A2c6D852f853;
    address constant BRAT_POOL = 0xEef48Df5F1c509cD9730774b4e8A4464626ef8D5;

    uint256 constant CAP = 1_500e18;
    uint256 constant DAILY = 5_000e18;

    PolicyVault vault;
    address owner = makeAddr("owner");
    address agent = makeAddr("agent");
    address arSupplier = makeAddr("arSupplier");
    address brSupplier = makeAddr("brSupplier");
    address stranger = makeAddr("stranger");

    function setUp() public {
        vault = new PolicyVault(owner, ARGT, BRAT, ARGT_POOL, BRAT_POOL);
        vm.startPrank(owner);
        vault.setAgent(agent);
        vault.setLimits(CAP, DAILY);
        vault.setSupplier(arSupplier, ARGT, true);
        vault.setSupplier(brSupplier, BRAT, true);
        vm.stopPrank();
        deal(ARGT, address(vault), 20_000e18);
    }

    function _pay(bytes32 id, address to, uint256 amount, uint256 minOut) internal {
        vm.prank(agent);
        vault.pay(id, to, amount, minOut);
    }

    function test_constructorReadsPools() public view {
        assertEq(address(vault.USDT0()), ICurvePool(ARGT_POOL).coins(1));
        assertEq(address(vault.USDT0()), ICurvePool(BRAT_POOL).coins(1));
    }

    function test_argtPaymentExecutes() public {
        vm.expectEmit(address(vault));
        emit IPolicyVault.PaymentExecuted("inv_001", arSupplier, ARGT, 1_000e18, 1_000e18);
        _pay("inv_001", arSupplier, 1_000e18, 1_000e18);
        assertEq(IERC20(ARGT).balanceOf(arSupplier), 1_000e18);
        assertEq(vault.spentToday(), 1_000e18);
        assertTrue(vault.used("inv_001"));
    }

    function test_bratPaymentSwapsThroughBothPools() public {
        uint256 amount = 1_000e18;
        uint256 usdt = ICurveQuote(ARGT_POOL).get_dy(0, 1, amount);
        uint256 quote = ICurveQuote(BRAT_POOL).get_dy(1, 0, usdt);
        uint256 minOut = quote * 99 / 100;
        uint256 vaultBefore = IERC20(ARGT).balanceOf(address(vault));
        uint256 usdtBefore = IERC20(vault.USDT0()).balanceOf(address(vault));

        _pay("inv_002", brSupplier, amount, minOut);

        uint256 received = IERC20(BRAT).balanceOf(brSupplier);
        assertGe(received, minOut);
        assertGt(received, 0);
        assertEq(IERC20(ARGT).balanceOf(address(vault)), vaultBefore - amount);
        assertEq(IERC20(vault.USDT0()).balanceOf(address(vault)), usdtBefore, "no USDT0 left behind");
        assertEq(IERC20(ARGT).allowance(address(vault), ARGT_POOL), 0, "no leftover approval");
        assertEq(IERC20(vault.USDT0()).allowance(address(vault), BRAT_POOL), 0, "no leftover approval");
    }

    function test_bratPaymentRevertsBelowMinOut() public {
        vm.expectRevert();
        _pay("inv_003", brSupplier, 1_000e18, type(uint128).max);
        assertFalse(vault.used("inv_003"), "reverted payment leaves id unused");
    }

    function test_notAllowlistedIsRejected() public {
        uint256 before = IERC20(ARGT).balanceOf(address(vault));
        vm.expectEmit(address(vault));
        emit IPolicyVault.PaymentRejected("inv_004", stranger, "not_allowlisted");
        _pay("inv_004", stranger, 100e18, 0);
        assertEq(IERC20(ARGT).balanceOf(address(vault)), before);
        assertEq(IERC20(ARGT).balanceOf(stranger), 0);
        assertTrue(vault.used("inv_004"));
        assertEq(vault.spentToday(), 0);
    }

    function test_overPaymentCapIsRejected() public {
        vm.expectEmit(address(vault));
        emit IPolicyVault.PaymentRejected("inv_005", arSupplier, "over_payment_cap");
        _pay("inv_005", arSupplier, CAP + 1, 0);
        assertEq(IERC20(ARGT).balanceOf(arSupplier), 0);
        assertTrue(vault.used("inv_005"));
    }

    function test_overDailyCapIsRejectedThenResetsNextDay() public {
        _pay("d1", arSupplier, 1_500e18, 0);
        _pay("d2", arSupplier, 1_500e18, 0);
        _pay("d3", arSupplier, 1_500e18, 0); // 4_500 spent
        vm.expectEmit(address(vault));
        emit IPolicyVault.PaymentRejected("d4", arSupplier, "over_daily_cap");
        _pay("d4", arSupplier, 1_000e18, 0);
        assertEq(vault.spentToday(), 4_500e18, "rejections do not count");

        vm.warp(block.timestamp + 1 days);
        assertEq(vault.spentToday(), 0);
        _pay("d5", arSupplier, 1_000e18, 0);
        assertEq(vault.spentToday(), 1_000e18);
        assertEq(IERC20(ARGT).balanceOf(arSupplier), 5_500e18);
    }

    function test_nonAgentReverts() public {
        vm.prank(stranger);
        vm.expectRevert(PolicyVault.NotAgent.selector);
        vault.pay("inv_006", arSupplier, 1e18, 0);
    }

    function test_reusedInvoiceIdReverts() public {
        _pay("inv_007", arSupplier, 1e18, 0);
        vm.prank(agent);
        vm.expectRevert(abi.encodeWithSelector(PolicyVault.AlreadyPaid.selector, bytes32("inv_007")));
        vault.pay("inv_007", arSupplier, 1e18, 0);
    }

    function test_rejectedInvoiceIdCannotBeRetried() public {
        _pay("inv_008", stranger, 1e18, 0);
        vm.prank(agent);
        vm.expectRevert(abi.encodeWithSelector(PolicyVault.AlreadyPaid.selector, bytes32("inv_008")));
        vault.pay("inv_008", arSupplier, 1e18, 0);
    }

    function test_pausedReverts() public {
        vm.prank(owner);
        vault.pause();
        vm.prank(agent);
        vm.expectRevert(Pausable.EnforcedPause.selector);
        vault.pay("inv_009", arSupplier, 1e18, 0);
    }

    function test_setSupplierRejectsOtherTokens() public {
        address usdt = address(vault.USDT0());
        vm.prank(owner);
        vm.expectRevert(abi.encodeWithSelector(PolicyVault.UnsupportedToken.selector, usdt));
        vault.setSupplier(stranger, usdt, true);
    }

    function test_removeSupplier() public {
        vm.prank(owner);
        vault.setSupplier(arSupplier, address(0), false);
        assertFalse(vault.isAllowed(arSupplier));
    }

    function test_onlyOwnerAdmin() public {
        vm.startPrank(stranger);
        vm.expectRevert();
        vault.setAgent(stranger);
        vm.expectRevert();
        vault.setLimits(1, 1);
        vm.expectRevert();
        vault.setSupplier(stranger, ARGT, true);
        vm.expectRevert();
        vault.withdraw(ARGT, stranger, 1);
        vm.stopPrank();
    }

    function test_ownerWithdraw() public {
        vm.prank(owner);
        vault.withdraw(ARGT, owner, 1_000e18);
        assertEq(IERC20(ARGT).balanceOf(owner), 1_000e18);
    }
}
