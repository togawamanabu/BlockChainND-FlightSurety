
var Test = require('../config/testConfig.js');
var BigNumber = require('bignumber.js');

contract('Flight Surety Tests', async (accounts) => {

    const fundfee = web3.utils.toWei('10', "ether");
    const overInsurancefee = web3.utils.toWei('2', "ether");
    const insurancefee = web3.utils.toWei('1', "ether");

    const timestamp = Math.floor(Date.now() / 1000);
    const flightname = "FLY0001";

    let airline2;
    let airline3;
    let airline4;
    let airline5;
    let airline6;
    let passenger;

    var config;
  before('setup contract', async () => {
    config = await Test.Config(accounts);
    await config.flightSuretyData.authorizedContract(config.flightSuretyApp.address);

    airline2 = config.testAddresses[2];
    airline3 = config.testAddresses[3];
    airline4 = config.testAddresses[4];
    airline5 = config.testAddresses[5];
    airline6 = config.testAddresses[6];

    passenger = config.testAddresses[7];
  });

  /****************************************************************************************/
  /* Operations and Settings                                                              */
  /****************************************************************************************/

  it(`(multiparty) has correct initial isOperational() value`, async function () {

    // Get operating status
    let status = await config.flightSuretyData.isOperational.call();
    assert.equal(status, true, "Incorrect initial operating status value");

  });

  it(`(multiparty) can block access to setOperatingStatus() for non-Contract Owner account`, async function () {

      // Ensure that access is denied for non-Contract Owner account
      let accessDenied = false;
      try 
      {
          await config.flightSuretyData.setOperatingStatus(false, { from: config.testAddresses[2] });
      }
      catch(e) {
          accessDenied = true;
      }
      assert.equal(accessDenied, true, "Access not restricted to Contract Owner");
            
  });

  it(`(multiparty) can allow access to setOperatingStatus() for Contract Owner account`, async function () {

      // Ensure that access is allowed for Contract Owner account
      let accessDenied = false;
      try 
      {
          await config.flightSuretyData.setOperatingStatus(false);
      }
      catch(e) {
          accessDenied = true;
      }
      assert.equal(accessDenied, false, "Access not restricted to Contract Owner");
      
  });

  it(`(multiparty) can block access to functions using requireIsOperational when operating status is false`, async function () {

      await config.flightSuretyData.setOperatingStatus(false);

      let reverted = false;
      try 
      {
          await config.flightSurety.setTestingMode(true);
      }
      catch(e) {
          reverted = true;
      }
      assert.equal(reverted, true, "Access not blocked for requireIsOperational");      

      // Set it back for other tests to work
      await config.flightSuretyData.setOperatingStatus(true);

  });

    ////// Airline /////

  it('(airline initial airlines',
  async() => {
   let result = await config.flightSuretyApp.getAirlineList({from: config.firstAirline});

   assert.equal(result.length, 1, "initial airline");
  } )

  it('(airline) cannot register an Airline using registerAirline() if it is not funded', async () => {
    
    // ARRANGE
    let newAirline = config.testAddresses[2];

    // ACT
    try {
        await config.flightSuretyApp.registerAirline(newAirline, {from: config.firstAirline});
    }
    catch(e) {

    }
    let result = await config.flightSuretyData.isRegisteredAirline(newAirline); 

    // ASSERT
    assert.equal(result, false, "Airline should not be able to register another airline if it hasn't provided funding");

  });

  it('Fund First airline.', async () => {    
    let originalvalue = await web3.eth.getBalance(await config.flightSuretyData.getContractOwner());

    await config.flightSuretyApp.fundAirline({from: config.firstAirline, value: fundfee});

    let result = await config.flightSuretyData.isValidAirline(config.firstAirline); 

    let aftervalue = await web3.eth.getBalance(await config.flightSuretyData.getContractOwner());

    console.log('value transfered', originalvalue, aftervalue);

    // ASSERT
    assert.equal(result, true, "Airline funded and valid airline");
  });


 it('first airline register until 4 airlines', async () => {
    
    // ARRANGE
    await config.flightSuretyApp.registerAirline(airline2, {from: config.firstAirline});
    let result1 = await config.flightSuretyData.isRegisteredAirline(airline2); 

    await config.flightSuretyApp.registerAirline(airline3, {from: config.firstAirline});
    let result2 = await config.flightSuretyData.isRegisteredAirline(airline3); 

    await config.flightSuretyApp.registerAirline(airline4, {from: config.firstAirline});
    let result3 = await config.flightSuretyData.isRegisteredAirline(airline4); 

    // ASSERT
    assert.equal(result1, true, "Airline2 should able to register ");
    assert.equal(result2, true, "Airline3 should able to register ");
    assert.equal(result3, true, "Airline4 should able to register ");
    assert.equal(4, await config.flightSuretyData.getRegisteredAirlineCount());

  });

  it('5th airline can not register, need to vote from another airlines', async () => {
    await config.flightSuretyApp.registerAirline(airline5, {from: config.firstAirline});

    let result = await config.flightSuretyData.isRegisteredAirline(airline5); 

    // ASSERT
    assert.equal(result, false, "Airline should not be able to register after thureth hold");
  });

  it('airline can not dupicate vote ', async () => {
    let reverted = false;
    try {
        await config.flightSuretyApp.registerAirline(airline5, {from: config.firstAirline});
    }
    catch(e) {
        reverted = true;
    }

    // ASSERT
    assert.equal(reverted, true, "Same airline can not vote again");
  });

  it('Only funded airline can vote', async () => {
    
    let reverted = false;
    try {
        await config.flightSuretyApp.registerAirline(airline5, {from: config.testAddresses[2]});
    }
    catch(e) {
        reverted = true;
    }

    // ASSERT
    assert.equal(reverted, true, "Not funded airline can not vote");
  });

  it('Fund 2-4 airlines', async () => {    
    await config.flightSuretyApp.fundAirline({from: airline2, value: fundfee});
    await config.flightSuretyApp.fundAirline({from: airline3, value: fundfee});
    await config.flightSuretyApp.fundAirline({from: airline4, value: fundfee});

    let result2 = await config.flightSuretyData.isValidAirline(airline2); 
    let result3 = await config.flightSuretyData.isValidAirline(airline3); 
    let result4 = await config.flightSuretyData.isValidAirline(airline4);  

    // ASSERT
    assert.equal(result2, true, "Airline2 not funded");
    assert.equal(result3, true, "Airline3 not funded");
    assert.equal(result4, true, "Airline4 not funded");
  });

  it('Vote for airline5', async () => {    
    await config.flightSuretyApp.registerAirline(airline5, {from: airline2});

    let result = await config.flightSuretyData.isRegisteredAirline(airline5); 

    // ASSERT
    assert.equal(result, true, "second vote exceed 50%");
  });

  it('Vote for airline6 now need to have more than 3 vote', async () => { 
    assert.equal(await config.flightSuretyData.getRegisteredAirlineCount(), 5, "5 airline registered");
    assert.equal(await config.flightSuretyApp.getWaitingAirline(airline6), 0, "note vote yet");

      //first   
    await config.flightSuretyApp.registerAirline(airline6, {from: config.firstAirline});
    assert.equal(await config.flightSuretyApp.getWaitingAirline(airline6), 1, "first vote");

    let result1 = await config.flightSuretyData.isRegisteredAirline(airline6); 
    assert.equal(result1, false, "first vote not exceed 50%");

    //second
    await config.flightSuretyApp.registerAirline(airline6, {from: airline2});
    assert.equal(await config.flightSuretyApp.getWaitingAirline(airline6), 2, "second vote");

    let result2 = await config.flightSuretyData.isRegisteredAirline(airline6); 
    assert.equal(result2, false, "second vote not exceed 50%");

    //third
    await config.flightSuretyApp.registerAirline(airline6, {from: airline3});

    let result3 = await config.flightSuretyData.isRegisteredAirline(airline6); 
    assert.equal(result3, true, "third vote exceed 50%");

  });


  ////// Insurance /////
  it('Register flight from airline', async() => {
    await config.flightSuretyApp.registerFlight(flightname, timestamp, {from: config.firstAirline});

    let result = await config.flightSuretyApp.getFlight(config.firstAirline, flightname, timestamp);

    assert.equal(result, true, 'Flight registered');
  })

  it('passenger buy insurance, over value can not buy', async() => {
    
    let abort = false;
    try {
        await config.flightSuretyApp.buyInsurance(config.firstAirline, flightname, timestamp, {from: passenger, value: overInsurancefee});
    } catch {
        abort = true;
    }

    assert.equal(abort, true, 'Over insurance aborted');
  })

  it('passenger buy insurance', async() => {
    let originalvalue = await web3.eth.getBalance(await config.flightSuretyData.getContractOwner());

    await config.flightSuretyApp.buyInsurance(config.firstAirline, flightname, timestamp, {from:passenger, value: insurancefee});

    let aftervalue = await web3.eth.getBalance(await config.flightSuretyData.getContractOwner());

    let result = await config.flightSuretyData.isInsured(passenger, config.firstAirline, flightname, timestamp);

    console.log('value transfered', originalvalue, aftervalue);

    assert.equal(result, true, 'Passenger need to be insured');
  })


});
