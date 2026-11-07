// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Script, console2} from "forge-std/Script.sol";
import {PolicyVault} from "../src/PolicyVault.sol";

/// @notice Live demo "the contract said no": the agent key tries to pay a non-allowlisted address.
///         The tx succeeds but emits PaymentRejected("not_allowlisted") and moves no funds.
/// forge script script/ForceBadPayment.s.sol --rpc-url arbitrum --broadcast
/// The tx hash is printed by forge after broadcast (and saved in broadcast/ForceBadPayment.s.sol/42161/run-latest.json).
contract ForceBadPayment is Script {
    function run() external {
        PolicyVault vault = PolicyVault(vm.envAddress("POLICY_VAULT"));
        address bad = vm.envOr("BAD_RECIPIENT", address(0x000000000000000000000000000000000000dEaD));
        uint256 agentKey = vm.envUint("AGENT_PRIVATE_KEY");
        bytes32 invoiceId = keccak256(abi.encodePacked("force_bad_payment", block.timestamp));

        require(!vault.isAllowed(bad), "ForceBadPayment: recipient is allowlisted, pick another");
        console2.log("vault", address(vault));
        console2.log("bad recipient", bad);
        console2.logBytes32(invoiceId);

        vm.startBroadcast(agentKey);
        vault.pay(invoiceId, bad, 1e18, 0);
        vm.stopBroadcast();

        console2.log("Sent. Look for PaymentRejected(not_allowlisted) at:");
        console2.log("  https://arbiscan.io/address/", address(vault), "#events");
    }
}
