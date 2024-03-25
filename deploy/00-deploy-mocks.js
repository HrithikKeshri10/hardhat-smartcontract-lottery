const { ethers } = require("hardhat")

const BASE_FEE = ethers.parseEther("0.25") // 0.25 is the premium. It costs 0.25 LINK per request
const GAS_PRICE_LINK = 1e9 // calculated value based on the gas price of the chain
// Chainlink node pay the gas fees to give us randomness and do external calculation
// So the price of requests changes based on the price of gas

module.exports = async function ({ getNamedAccounts, deployments }) {
    const { deploy, log } = deployments
    const { deployer } = await getNamedAccounts()
    const chainId = network.config.chainId
    const args = [BASE_FEE, GAS_PRICE_LINK]

    if (chainId == 31337) {
        log("Local network detected! Deploying Mocks...")
        // Deploy a Mock VRFCoordinatorV2
        await deploy("VRFCoordinatorV2Mock", {
            from: deployer,
            log: true,
            args: args,
        })
        log("Mocks deployed!")
        log("------------------------------------------")
    }
}

module.exports.tags = ["all", "mocks"]
