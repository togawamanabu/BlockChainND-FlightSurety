pragma solidity ^0.5.16;

import "../node_modules/@openzeppelin/contracts/math/SafeMath.sol";

contract FlightSuretyData {
    using SafeMath for uint256;

    uint256 INSURANCE_PAYBACK_PERCENT = 150;

    /********************************************************************************************/
    /*                                       DATA VARIABLES                                     */
    /********************************************************************************************/

    struct Airline {
        bool isRegistered;
        bool isFunded;
    }

    struct Insurance {
        bool isRegistered;
        uint256 payedValue;
        bool isCredited;
        uint256 creditValue;
    }

    struct InsuredPassengers {
        address[] passengers; //passenger list
        mapping(address => Insurance) details; //passenger address => insurance details
    }

    address private contractOwner;                                      // Account used to deploy contract
    bool private operational = true;                                    // Blocks all state changes throughout the contract if false
    uint registeredAirlinesCount;   //count registered airline
    address[] private airlineList;

    mapping(address => uint256) private authorizedContracts;        //Authorized Contract address
    mapping(address => Airline) private airlines;
    mapping(bytes32 => InsuredPassengers) private insurances;      //flightkey => 

    mapping(address => uint256) private withdrawableWallet;

    /********************************************************************************************/
    /*                                       EVENT DEFINITIONS                                  */
    /********************************************************************************************/

    event AirlineRegistered(address airline);
    event AirlineFunded(address airline);
    event InsurancePurchase(bytes32 flightkey, address passenger, uint256 amount);
    event PayInsuree(address passenger, uint256 amount);
    event CreditInsurees(address passenger, bytes32 flightkey, uint256 amount);

    /**
    * @dev Constructor
    *      The deploying account becomes contractOwner
    */
    constructor
                                (
                                    address airlineAddress
                                ) 
                                public 
    {
        contractOwner = msg.sender;
        airlines[airlineAddress] = Airline({isRegistered:true, isFunded: false});
        airlineList.push(airlineAddress);
        registeredAirlinesCount = 1;
    }

    /********************************************************************************************/
    /*                                       FUNCTION MODIFIERS                                 */
    /********************************************************************************************/

    // Modifiers help avoid duplication of code. They are typically used to validate something
    // before a function is allowed to be executed.

    /**
    * @dev Modifier that requires the "operational" boolean variable to be "true"
    *      This is used on all state changing functions to pause the contract in 
    *      the event there is an issue that needs to be fixed
    */
    modifier requireIsOperational() 
    {
        require(operational, "Contract is currently not operational");
        _;  // All modifiers require an "_" which indicates where the function body will be added
    }

    /**
    * @dev Modifier that requires the "ContractOwner" account to be the function caller
    */
    modifier requireContractOwner()
    {
        require(msg.sender == contractOwner, "Caller is not contract owner");
        _;
    }

    modifier isCallerAuthorized()
    {
        require(authorizedContracts[msg.sender]  == 1, "Caller is not authorized");
        _;
    }

    // not registered airline
    modifier requireAirlineIsNotRegistered(address airline) {
        require(!isRegisteredAirline(airline), "Airline is already registered");
        _;
    }

    modifier requireAirlineRegistered(address airline) {
        require(isRegisteredAirline(airline), "Airline is not registered");
        _;
    }


    modifier requireValidAirline(address airline) {
        require(isValidAirline(airline), "Airline is not funded");
        _;
    }

    modifier requireNotValidAirline(address airline) {
        require(!isValidAirline(airline), "Airline is funded");
        _;
    }

    modifier paidEnough(uint _price) { 
        require(msg.value >= _price, "not payed enough"); 
        _;
    }

    modifier checkValue(uint _price) {
        _;
        uint amountToReturn = msg.value - _price;
        msg.sender.transfer(amountToReturn);
    }

    modifier requirePassengerNotInsured(address passenger, address airline, string memory flightname, uint256 timestamp) {
        require(!isInsured(passenger, airline, flightname, timestamp), "Passenger already insured");
        _;
    }

    modifier requireHaveCredit(address passenger) {
        require(withdrawableWallet[passenger] > 0, 'does not have credit');
        _;
    }
    
    modifier requireContractHaveBalance(address passenger) {
        uint amount = withdrawableWallet[passenger];
        require(address(this).balance >= amount, 'Contract does not have enough balance');
        _;
    }

    ///Contract authorization

    function authorizedContract(address addContract) external requireContractOwner {
        authorizedContracts[addContract] = 1;        
    }

    function deauthorizedContract(address addContract) external requireContractOwner {
        delete authorizedContracts[addContract];        
    }

    /********************************************************************************************/
    /*                                       UTILITY FUNCTIONS                                  */
    /********************************************************************************************/

    /**
    * @dev Get operating status of contract
    *
    * @return A bool that is the current operating status
    */      
    function isOperational() 
                            public 
                            view 
                            returns(bool) 
    {
        return operational;
    }

    /**
    * @dev Sets contract operations on/off
    *
    * When operational mode is disabled, all write transactions except for this one will fail
    */    
    function setOperatingStatus
                            (
                                bool mode
                            ) 
                            external
                            requireContractOwner 
    {
        operational = mode;
    }

    //registered airline
    function isRegisteredAirline(address airline) public view requireIsOperational returns(bool) {
        return airlines[airline].isRegistered;
    }

    //is funded airline
    function isValidAirline(address airline) public view requireIsOperational returns(bool) {
        return airlines[airline].isFunded;
    }

    // airline count
    function getRegisteredAirlineCount() public view requireIsOperational returns(uint) {
        return registeredAirlinesCount;
    }

    //constructors value
    function getContractOwner() public view requireIsOperational returns(address) {
        return contractOwner;
    }

    //insured
    function isInsured(address passenger, address airline, string memory flightname, uint256 timestamp) public view requireIsOperational returns(bool) {
         bytes32 flightKey = getFlightKey(airline, flightname, timestamp);

         return(insurances[flightKey].details[passenger].isRegistered);
    }

    /********************************************************************************************/
    /*                                     SMART CONTRACT FUNCTIONS                             */
    /********************************************************************************************/

   /**
    * @dev Add an airline to the registration queue
    *      Can only be called from FlightSuretyApp contract
    *
    */   
    function registerAirline
                            (address airlineAddress,
                            address senderAddress)
                            external
                            requireIsOperational
                            isCallerAuthorized
                            requireAirlineIsNotRegistered(airlineAddress)
                            requireValidAirline(senderAddress)
    {        
        airlines[airlineAddress] = Airline({isRegistered:true, isFunded: false});

        airlineList.push(airlineAddress);
        registeredAirlinesCount = registeredAirlinesCount.add(1);

       emit AirlineRegistered(airlineAddress);
    }


   /**
    * @dev Buy insurance for a flight
    *
    */   
    function buyInsurance(address airline, string memory flightname, uint256 timestamp, address passenger) public payable 
                        requireIsOperational
                        isCallerAuthorized
    {
        address(this).transfer(msg.value);

        bytes32 flightKey = getFlightKey(airline, flightname, timestamp);

        insurances[flightKey].details[passenger] = Insurance({isRegistered: true, payedValue: msg.value, isCredited: false, creditValue: 0});
        insurances[flightKey].passengers.push(passenger);

        emit InsurancePurchase(flightKey, passenger, msg.value);
    }

    /**
     *  @dev Credits payouts to insurees
    */
    function creditInsurees(address airline, string memory flightname, uint256 timestamp) internal
                requireIsOperational
                isCallerAuthorized
    {
        bytes32 flightKey = getFlightKey(airline, flightname, timestamp);
        for(uint i=0; i<insurances[flightKey].passengers.length; i++) {
            address passenger = insurances[flightKey].passengers[i];
            
            Insurance memory insurance = insurances[flightKey].details[passenger];

            if(!insurance.isCredited){            
                uint256 amount = insurance.payedValue.mul(INSURANCE_PAYBACK_PERCENT).div(100);

                insurances[flightKey].details[passenger].isCredited = true;
                insurances[flightKey].details[passenger].creditValue = amount;

                withdrawableWallet[passenger] = withdrawableWallet[passenger].add(amount);

                emit CreditInsurees(passenger, flightKey, amount);
            }
        }
    }
    

    /**
     *  @dev Transfers eligible payout funds to insuree
     *
    */
    function pay(address payable passenger) external payable
            requireIsOperational
            requireHaveCredit(passenger)
            requireContractHaveBalance(passenger)
    {
        uint256 amount = withdrawableWallet[passenger];
        
        withdrawableWallet[passenger] = 0;

        passenger.transfer(amount);

        emit PayInsuree(passenger, amount);
    }

   /**
    * @dev Initial funding for the insurance. Unless there are too many delayed flights
    *      resulting in insurance payouts, the contract should be self-sustaining
    *
    */   
    function fundAirline
                            (
                                address airlineAddress, 
                                uint price
                            )
                            external
                            payable
                            requireIsOperational
                            isCallerAuthorized
                            requireAirlineRegistered(airlineAddress)
                            requireNotValidAirline(airlineAddress)
                            returns(bool)
    {
        address(this).transfer(price);

        airlines[airlineAddress].isFunded = true;

        emit AirlineFunded(airlineAddress);

        return airlines[airlineAddress].isFunded;
    }

    function getAirlineList() public view 
        requireIsOperational
        returns(address[] memory) {
            return(airlineList);
        }

    function getAirline(address airlineAddress) external view requireIsOperational
                returns(bool, bool) {
        Airline memory airline = airlines[airlineAddress];
        return (airline.isRegistered, airline.isFunded);
    }

    function getFlightKey
                        (
                            address airline,
                            string memory flight,
                            uint256 timestamp
                        )
                        pure
                        internal
                        returns(bytes32) 
    {
        return keccak256(abi.encodePacked(airline, flight, timestamp));
    }

    /**
    * @dev Fallback function for funding smart contract.
    *
    */
    function() 
                            external 
                            payable 
    {
        //fund();
    }

}

