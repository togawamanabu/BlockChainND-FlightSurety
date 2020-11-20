import FlightSuretyApp from '../../build/contracts/FlightSuretyApp.json';
import Config from './config.json';
import Web3 from 'web3';
import express from 'express';

let config = Config['localhost'];
let web3 = new Web3(new Web3.providers.WebsocketProvider(config.url.replace('http', 'ws')));
web3.eth.defaultAccount = web3.eth.accounts[0];

let accounts;

let flightSuretyApp = new web3.eth.Contract(FlightSuretyApp.abi, config.appAddress);

let oracles = [];

const STATUS_CODE_UNKNOWN = 0;
const STATUS_CODE_ON_TIME = 10;
const STATUS_CODE_LATE_AIRLINE = 20;
const STATUS_CODE_LATE_WEATHER = 30;
const STATUS_CODE_LATE_TECHNICAL = 40;
const STATUS_CODE_LATE_OTHER = 50;

const statusCodes = [
  STATUS_CODE_UNKNOWN,
  STATUS_CODE_ON_TIME,
  STATUS_CODE_LATE_AIRLINE,
  STATUS_CODE_LATE_WEATHER,
  STATUS_CODE_LATE_TECHNICAL,
  STATUS_CODE_LATE_OTHER
];


async function registerOracles() {
  accounts = await web3.eth.getAccounts();

  let fee = await flightSuretyApp.methods.REGISTRATION_FEE().call();
  let oraclecount = config.oracleCount;

  for(var i=0; i<oraclecount; i++) {
    oracles.push(accounts[i]);
    let rtn = await flightSuretyApp.methods.registerOracles().call({
      from: accounts[i],
      value: fee
    })
    console.log(`Oracle registreted: [${i}], ${rtn[0]}, ${rtn[1]}, ${rtn[2]}`);
  }
}

registerOracles();

async function submitOracleResponse(index, airline, flight, timestamp) {
  for(var i=0; i<oracles.length; i++) {
    let status = statusCodes[Math.floor(Math.random() * 6)];
    var indexes = await flightSuretyApp.methods.getMyIndexes().call({from: oracles[i]});

    for(var j=0; j<indexes.length; j++) {
      if(indexes[j] == index) {
        try {
          await flightSuretyApp.methods.submitOracleResponse(
            indexes[j], airline, flight, timestamp, status
          ).call({from: oracles[i]});
        } catch(e) {
          console.log(e);
        }
      }
    }
  }
}

flightSuretyApp.events.OracleRequest({
    fromBlock: 0
  }, function (error, event) {
    if (error) {
      console.log(error);
    } else {
      let index = event.returnValues.index;
      let airline = event.returnValues.airline;
      let flight = event.returnValues.flight;
      let timestamp = event.returnValues.timestamp;

      submitOracleResponse(index, airline, flight, timestamp);
    }

});

const app = express();
app.get('/api', (req, res) => {
    res.send({
      message: 'An API for use with your Dapp!'
    })
})

export default app;


