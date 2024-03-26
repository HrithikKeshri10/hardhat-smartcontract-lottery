const { network, ethers } = require("hardhat")
const { developmentChains, networkConfig } = require("../helper-hardhat-config")
const { verify } = require("../utils/verify")

const VRF_SUB_FUND_AMOUNT = ethers.parseEther("2")

module.exports = async function ({ getNamedAccounts, deployments }) {
    const { deploy, log } = deployments
    const { deployer } = await getNamedAccounts()
    const chainId = network.config.chainId

    let vrfCoordinatorV2Address, subscriptionID, vrfCoordinatorV2Mock, contractAddress
    if (chainId == 31337) {
        contractAddress = (await deployments.get("VRFCoordinatorV2Mock")).address
        vrfCoordinatorV2Mock = await ethers.getContractAt("VRFCoordinatorV2Mock", contractAddress)
        vrfCoordinatorV2Address = contractAddress
        // We created the subscription
        const transactionResponse = await vrfCoordinatorV2Mock.createSubscription()
        const transactionReceipt = await transactionResponse.wait(1)
        subscriptionID = transactionReceipt.logs[0].args.subId
        // Now we have to fund the subscription
        // We need LINK token to fund the subscription on a real network
        await vrfCoordinatorV2Mock.fundSubscription(subscriptionID, VRF_SUB_FUND_AMOUNT)
    } else {
        vrfCoordinatorV2Address = networkConfig[chainId]["vrfCoordinatorV2"]
        subscriptionID = networkConfig[chainId]["subscriptionId"]
    }

    const entranceFee = networkConfig[chainId]["entranceFee"]
    const gasLane = networkConfig[chainId]["gasLane"]
    const callbackGasLimit = networkConfig[chainId]["callbackGasLimit"]
    const interval = networkConfig[chainId]["interval"]
    const args = [
        vrfCoordinatorV2Address,
        entranceFee,
        gasLane,
        subscriptionID,
        callbackGasLimit,
        interval,
    ]

    log("Deploying Raffle and waiting for confirmations...")

    const raffle = await deploy("Raffle", {
        from: deployer,
        args: args,
        log: true,
        waitConfirmations: network.config.blockConfirmations || 1,
    })

    log(`Raffle deployed at ${raffle.address}`)

    if (chainId == 31337) {
        log(`Adding Consumer...`)
        contractAddress = (await deployments.get("VRFCoordinatorV2Mock")).address
        vrfCoordinatorV2Mock = await ethers.getContractAt("VRFCoordinatorV2Mock", contractAddress)

        await vrfCoordinatorV2Mock.addConsumer(subscriptionID, raffle.address)
        log(`Consumer Successfully Added!`)
    }

    if (chainId != 31337 && process.env.ETHERSCAN_API_KEY) {
        await verify(raffle.address, args)
    }

    log("---------------------------------------------------")
}
module.exports.tags = ["all", "raffle"]
