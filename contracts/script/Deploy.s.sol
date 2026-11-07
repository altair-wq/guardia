// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Script, console2} from "forge-std/Script.sol";
import {PolicyVault} from "../src/PolicyVault.sol";

/// @notice Deploys PolicyVault on Arbitrum One, sets the agent, caps and the 3 demo suppliers.
/// forge script script/Deploy.s.sol --rpc-url arbitrum --broadcast --verify
contract Deploy is Script {
    // Arbitrum One (chain id 42161), from SHARED_CONTRACTS.md
    address constant ARGT = 0x59863989d080B22476DB95656d0C3CC18be92214;
    address constant BRAT = 0xC4ed6Aba5373D78E160F4df39e011F078Be54df8;
    address constant ARGT_POOL = 0x356D349dA9ADd7Efb56a35fAB939A2c6D852f853;
    address constant BRAT_POOL = 0xEef48Df5F1c509cD9730774b4e8A4464626ef8D5;

    function run() external returns (PolicyVault vault) {
        require(block.chainid == 42161, "Deploy: not Arbitrum One");
        uint256 deployerKey = vm.envUint("DEPLOYER_PRIVATE_KEY");
        address deployer = vm.addr(deployerKey);
        address agent = vm.envAddress("AGENT_ADDRESS");
        uint256 perPaymentCap = vm.envUint("PER_PAYMENT_CAP_ARGT") * 1e18;
        uint256 dailyCap = vm.envUint("DAILY_CAP_ARGT") * 1e18;

        console2.log("deployer", deployer, "ETH wei", deployer.balance);
        console2.log("agent   ", agent, "ETH wei", agent.balance);
        require(deployer.balance > 0, "Deploy: deployer has 0 ETH on Arbitrum, fund it for gas");
        require(agent.balance > 0, "Deploy: agent has 0 ETH on Arbitrum, fund it for gas");

        vm.startBroadcast(deployerKey);
        vault = new PolicyVault(deployer, ARGT, BRAT, ARGT_POOL, BRAT_POOL);
        vault.setAgent(agent);
        vault.setLimits(perPaymentCap, dailyCap);
        // Demo suppliers (see shared/fixtures/rules.json): two Brazilian (BRAt), one Argentine (ARGt)
        vault.setSupplier(vm.envAddress("SUPPLIER_BR_WALLET"), BRAT, true); // Autopecas Sul Ltda
        vault.setSupplier(vm.envAddress("SUPPLIER_BR2_WALLET"), BRAT, true); // Textil Parana Ltda
        vault.setSupplier(vm.envAddress("SUPPLIER_AR_WALLET"), ARGT, true); // Insumos del Litoral SRL
        vm.stopBroadcast();

        console2.log("PolicyVault", address(vault));
        console2.log("perPaymentCap (ARGt)", perPaymentCap / 1e18, "dailyCap (ARGt)", dailyCap / 1e18);
        console2.log("NEXT: fund the vault with ARGt, e.g.:");
        console2.log("  cast send", ARGT, "'transfer(address,uint256)' <vault> <amount_wei> --private-key $DEPLOYER_PRIVATE_KEY --rpc-url arbitrum");
        console2.log("THEN: ./script/export-deployment.sh <vault>  (writes deployments/arbitrum.json)");
    }
}
