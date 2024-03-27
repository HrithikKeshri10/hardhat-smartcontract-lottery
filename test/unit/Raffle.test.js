const { network, getNamedAccounts, ethers } = require("hardhat")
const { developmentChains, networkConfig } = require("../../helper-hardhat-config")
const { assert, expect } = require("chai")

!developmentChains.includes(network.name)
    ? describe.skip
    : describe("Raffle Unit tests", async () => {
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

          describe("checkUpkeep", async () => {
              it("returns false if people haven't sent any ETH", async () => {
                  await network.provider.send("evm_increaseTime", [Number(interval) + 1])
                  await network.provider.send("evm_mine", [])

                  const getUpkeep = await raffle.checkUpkeep("0x")
                  const { 0: upkeepNeeded, 1: performData } = getUpkeep
                  assert(!upkeepNeeded)
              })

              it("returns false if raffle isn't open", async () => {
                  await raffle.enterRaffle({ value: raffleEntranceFee })
                  await network.provider.send("evm_increaseTime", [Number(interval) + 1])
                  await network.provider.send("evm_mine", [])

                  await raffle.performUpkeep("0x")
                  const raffleState = await raffle.getRaffleState()
                  const getUpkeep = await raffle.checkUpkeep("0x")
                  const { 0: upkeepNeeded, 1: performData } = getUpkeep

                  assert(!upkeepNeeded)
                  assert(raffleState.toString(), "1")
              })

              it("returns false if enough time hasn't passed", async function () {
                  await raffle.enterRaffle({ value: raffleEntranceFee })
                  await network.provider.send("evm_increaseTime", [Number(interval) - 3]) // use a higher number here if this test fails
                  await network.provider.send("evm_mine", [])

                  const getUpkeep = await raffle.checkUpkeep("0x") // upkeepNeeded = (timePassed && isOpen && hasBalance && hasPlayers)
                  const { 0: upkeepNeeded, 1: performData } = getUpkeep
                  assert(!upkeepNeeded)
              })

              it("returns true if enough time has passed, has players, eth, and is open", async function () {
                  await raffle.enterRaffle({ value: raffleEntranceFee })
                  await network.provider.send("evm_increaseTime", [Number(interval) + 1])
                  await network.provider.send("evm_mine", [])
                  const getUpkeep = await raffle.checkUpkeep("0x") // upkeepNeeded = (timePassed && isOpen && hasBalance && hasPlayers)
                  const { 0: upkeepNeeded, 1: performData } = getUpkeep
                  assert(upkeepNeeded)
              })
          })

          describe("performUpkeep", async () => {
              it("can only run if checkupkeep is true", async () => {
                  await raffle.enterRaffle({ value: raffleEntranceFee })
                  await network.provider.send("evm_increaseTime", [Number(interval) + 1])
                  await network.provider.send("evm_mine", [])

                  const tx = await raffle.performUpkeep("0x")
                  assert(tx)
              })

              it("reverts when checkupkeep is false", async () => {
                  await expect(raffle.performUpkeep("0x")).to.be.revertedWithCustomError(
                      raffle,
                      "Raffle__UpkeepNotNeeded"
                  )
              })

              it("updates the raffle state, emits an event and calls the vrf coordinator", async () => {
                  await raffle.enterRaffle({ value: raffleEntranceFee })
                  await network.provider.send("evm_increaseTime", [Number(interval) + 1])
                  await network.provider.send("evm_mine", [])

                  const txResponse = await raffle.performUpkeep("0x")
                  const txReceipt = await txResponse.wait(1)

                  // We are using events[1] as vrfCoordinator will emit events 1st, so it's index will be 0
                  const requestId = txReceipt.logs[1].args.requestId
                  console.log(`requestId: ${requestId}`)
                  const raffleState = await raffle.getRaffleState()
                  assert(Number(requestId) > 0)
                  assert(Number(raffleState) == 1)
              })
          })

          describe("fulfillRandomWords", async () => {
              beforeEach(async () => {
                  await raffle.enterRaffle({ value: raffleEntranceFee })
                  await network.provider.send("evm_increaseTime", [Number(interval) + 1])
                  await network.provider.send("evm_mine", [])
              })

              it("can only be called after performUpkeep", async () => {
                  await expect(
                      vrfCoordinatorV2Mock.fulfillRandomWords(0, raffle.target)
                  ).to.be.revertedWith("nonexistent request")

                  await expect(
                      vrfCoordinatorV2Mock.fulfillRandomWords(1, raffle.target)
                  ).to.be.revertedWith("nonexistent request")
              })

              it("picks a winner, resets the lottery, and sends the money", async () => {
                  const additionalEntrances = 3
                  const startingAccountIndex = 1
                  const accounts = await ethers.getSigners()
                  for (
                      let i = startingAccountIndex;
                      i < startingAccountIndex + additionalEntrances;
                      i++
                  ) {
                      const accountConnectedRaffle = raffle.connect(accounts[i])
                      await accountConnectedRaffle.enterRaffle({ value: raffleEntranceFee })
                  }
                  const startingTimeStamp = await raffle.getLatestTimeStamp()
                  // performUpKeep (mock chainlink keepers)
                  // fulfillRandomWords (mock being the chainlink VRF)

                  await new Promise(async (resolve, reject) => {
                      raffle.once("WinnerPicked", async () => {
                          console.log("Found the event!")
                          try {
                              const recentWinner = await raffle.getRecentWinner()
                              //console.log(recentWinner)
                              const raffleState = await raffle.getRaffleState()
                              const endingTimeStamp = await raffle.getLatestTimeStamp()
                              const numPlayers = await raffle.getNumberOfPlayers()
                              const winnerEndingBalance = await ethers.provider.getBalance(
                                  accounts[1]
                              )

                              assert.equal(numPlayers.toString(), "0")
                              assert.equal(raffleState.toString(), "0")
                              assert(endingTimeStamp > startingTimeStamp)
                              const delta = 0.000000000002
                              assert.closeTo(
                                  Number(ethers.formatEther(winnerEndingBalance)),
                                  Number(ethers.formatEther(winnerStartingBalance)) +
                                      Number(ethers.formatEther(raffleEntranceFee)) *
                                          additionalEntrances +
                                      Number(ethers.formatEther(raffleEntranceFee)),
                                  delta
                              )
                          } catch (e) {
                              reject(e)
                          }

                          resolve()
                      })
                      // Setting up the listener

                      // below, we will fire up the event, and the listener will pick it up, and resolve
                      const tx = await raffle.performUpkeep("0x")
                      const txReceipt = await tx.wait(1)
                      const winnerStartingBalance = await ethers.provider.getBalance(accounts[1])
                      await await vrfCoordinatorV2Mock.fulfillRandomWords(
                          txReceipt.logs[1].args.requestId,
                          raffle.target
                      )
                  })
              })
          })
      })
