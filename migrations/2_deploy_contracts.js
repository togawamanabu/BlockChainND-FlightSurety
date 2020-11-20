const FlightSuretyApp = artifacts.require("FlightSuretyApp");
const FlightSuretyData = artifacts.require("FlightSuretyData");
const fs = require('fs');

module.exports = async (deployer) => {
    let firstAirline = '0x6e19Fbd3A3E5D6039ceF95e6a64725ee96A7438e';

    await deployer.deploy(FlightSuretyData, firstAirline);
    await deployer.deploy(FlightSuretyApp, FlightSuretyData.address);

    let fsd = await FlightSuretyData.deployed();
    await fsd.authorizedContract(FlightSuretyApp.address);

    let config = {
        localhost: {
            url: 'http://127.0.0.1:7545',
            dataAddress: FlightSuretyData.address,
            appAddress: FlightSuretyApp.address
        }
    }
    fs.writeFileSync(__dirname + '/../src/dapp/config.json',JSON.stringify(config, null, '\t'), 'utf-8');
    fs.writeFileSync(__dirname + '/../src/server/config.json',JSON.stringify(config, null, '\t'), 'utf-8');

}


// function(deployer) {

//     let firstAirline = '0x6e19Fbd3A3E5D6039ceF95e6a64725ee96A7438e';
//     deployer.deploy(FlightSuretyData, firstAirline)
//     .then(() => {
//         return deployer.deploy(FlightSuretyApp, FlightSuretyData.address)
//                 .then(() => {
//                     let config = {
//                         localhost: {
//                             url: 'http://127.0.0.1:7545',
//                             dataAddress: FlightSuretyData.address,
//                             appAddress: FlightSuretyApp.address
//                         }
//                     }
//                     fs.writeFileSync(__dirname + '/../src/dapp/config.json',JSON.stringify(config, null, '\t'), 'utf-8');
//                     fs.writeFileSync(__dirname + '/../src/server/config.json',JSON.stringify(config, null, '\t'), 'utf-8');
//                 });
//     });
// }