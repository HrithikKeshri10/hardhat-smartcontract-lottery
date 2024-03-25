const { network, getNamedAccounts, ethers } = require("hardhat")
const { developmentChains, networkConfig } = require("../../helper-hardhat-config")
const { assert, expect } = require("chai")

!developmentChains.includes(network.name)
    ? describe.skip
    : describe("Raffle", async () => {
          let deployer, raffle, vrfCoordinatorV2Mock, raffleEntranceFee, interval
          const chainId = network.config.chainId

          beforeEach(async () => {
              deployer = (await getNamedAccounts()).deployer
              await deployments.fixture(["all"])

              const myContract = await deployments.get("Raffle")
              raffle = await ethers.getContractAt(myContract.abi, myContract.address)

              vrfCoordinatorV2Mock = await deployments.get("VRFCoordinatorV2Mock")
              vrfCoordinatorV2Mock = await ethers.getContractAt(
                  vrfCoordinatorV2Mock.abi,
                  vrfCoordinatorV2Mock.address
              )
              raffleEntranceFee = await raffle.getEntranceFee()
              interval = await raffle.getInterval()
          })

          describe("constructor", async () => {
              it("Initializes the raffle correctly", async () => {
                  // Ideally we make our test have just 1 assert per "it"
                  const raffleState = await raffle.getRaffleState() // Must be open
                  assert.equal(raffleState.toString(), "0")

                  const interval = await raffle.getInterval()
                  assert.equal(interval.toString(), networkConfig[chainId]["interval"])
              })
          })

          describe("enterRaffle", async () => {
              it("reverts when you don't pay enough", async () => {
                  await expect(raffle.enterRaffle()).to.be.revertedWithCustomError(
                      raffle,
                      "Raffle__NotEnoughETHEntered"
                  )
              })

              it("records players when they enter", async () => {
                  await raffle.enterRaffle({ value: raffleEntranceFee })
                  const playerFromContract = await raffle.getPlayer(0)
                  assert.equal(playerFromContract, deployer)
              })

              it("emits events on enter", async () => {
                  await expect(raffle.enterRaffle({ value: raffleEntranceFee })).to.emit(
                      raffle,
                      "RaffleEnter"
                  )
              })

              it("doesn't allow entrance when raffle is calculating", async () => {
                  await raffle.enterRaffle({ value: raffleEntranceFee })
                  await network.provider.send("evm_increaseTime", [Number(interval) + 1])
                  await network.provider.send("evm_mine", [])

                  
                  await raffle.performUpkeep("0x")

                  // Assert: Attempt to enter the raffle again and expect it to fail
                  await expect(
                      raffle.enterRaffle({ value: raffleEntranceFee })
                  ).to.be.revertedWithCustomError(raffle, "Raffle__NotOpen")
              })
          })
      })
