// SPDX-License-Identifier: MIT
// Compatible with OpenZeppelin Contracts ^5.0.0
pragma solidity ^0.8.26;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/utils/math/Math.sol";

/// @title SimpleSwap
/// @author Wayar Matías Nahuel
/// @notice This contract allows the addition and remove of liquidity, the swap between TokenA and TokenB and returns the price. 
/// @notice Also, implements IERC20 and manage the LQP token.
contract SimpleSwap is ERC20 {
    using SafeERC20 for IERC20;

    // Variables

    /// @dev address of token A, established in constructor
    address public token_A;
    /// @dev address of token B, established in constructor
    address public token_B;
    /// @dev reserves of token A
    uint public reserve_A;
    /// @dev reserves of token B
    uint public reserve_B;

    // Events

    /// @notice Emitted when liquidity is added
    /// @param provider address of who adds liquidity
    /// @param amountA amount token A
    /// @param amountB amount token B
    /// @param liquidity liquidity generated
    event LiquidityAdded(address indexed provider, uint amountA, uint amountB, uint liquidity);

    /// @notice Emitted when liquidity is removed
    /// @param provider address of who removes liquidity
    /// @param amountA amount token A
    /// @param amountB amount token B
    /// @param liquidity liquidity burned
    event LiquidityRemoved(address indexed provider, uint amountA, uint amountB, uint liquidity);

    /// @notice Emitted when liquidity is added
    /// @param user address of who realize the swap
    /// @param tokenIn token swapped
    /// @param tokenOut token swapped to
    /// @param amountIn amount admitted
    /// @param amountOut amount obtained
    event TokensSwapped(address indexed user, address tokenIn, address tokenOut, uint amountIn, uint amountOut);

    /// @notice Constructor that initialize the contract
    /// @dev sets the token A and token B addresses, and token and symbol for LP
    constructor(address _tokenA, address _tokenB) ERC20("LIQUIDITY_POOL", "LQP") {
        require(_tokenA != _tokenB, "tokens equals!");
        token_A = _tokenA;
        token_B = _tokenB;
    }

    /// @notice Adds liquidity and mints LQP tokens
    /// @dev emits the event {LiquidityAdded}
    /// @param tokenA address of token A
    /// @param tokenB address of token B
    /// @param amountADesired desired amount of token A
    /// @param amountBDesired desired amount of token B
    /// @param amountAMin minimum acceptable amount of token A
    /// @param amountBMin minimum acceptable amount of token B
    /// @param to address receiving liquidity tokens
    /// @param deadline timestamp to check if transaction is valid
    /// @return amountA amount of token A deposited
    /// @return amountB amount of token B deposited
    /// @return liquidity amount of LQP tokens minted
    function addLiquidity(
        address tokenA,
        address tokenB,
        uint amountADesired,
        uint amountBDesired,
        uint amountAMin,
        uint amountBMin,
        address to,
        uint deadline
    ) external returns (uint amountA, uint amountB, uint liquidity) {
        require(block.timestamp <= deadline, "Transaction expired");
        require(to != address(0), "Invalid 'to' address");

        address _token_A = token_A;
        address _token_B = token_B;
        
        require((tokenA == _token_A && tokenB == _token_B) || (tokenA == _token_B && tokenB == _token_A), "Invalid token pair");

        bool isTokenAIn = tokenA == _token_A;
        
        (amountA, amountB) = _calculateOptimalAmounts(
                                                        isTokenAIn,
                                                        amountADesired,
                                                        amountBDesired,
                                                        amountAMin,
                                                        amountBMin
                                                    );
        uint _reserve_A = reserve_A;
        uint _reserve_B = reserve_B;
                    
        if (isTokenAIn) {
            IERC20(_token_A).safeTransferFrom(msg.sender, address(this), amountA);
            IERC20(_token_B).safeTransferFrom(msg.sender, address(this), amountB);
        } else {
            IERC20(_token_A).safeTransferFrom(msg.sender, address(this), amountB);
            IERC20(_token_B).safeTransferFrom(msg.sender, address(this), amountA);
        }
                        
        uint _totalLiquidity = totalSupply();
        uint _temporalAmount;

        if (_totalLiquidity == 0) {
            liquidity = Math.sqrt(amountA * amountB);
        } else {
            liquidity = Math.min(
                (amountA * _totalLiquidity) / _reserve_A,
                (amountB * _totalLiquidity) / _reserve_B
            );
        }

        require(liquidity > 0, "Insufficient liquidity");

        if (isTokenAIn) {
            reserve_A = _reserve_A + amountA;
            reserve_B = _reserve_B + amountB;
        } else {
            reserve_A = _reserve_A + amountB;
            reserve_B = _reserve_B + amountA;
            _temporalAmount = amountA;
            amountA = amountB;
            amountB = _temporalAmount;
        }                
            
        _mint(to, liquidity);
        emit LiquidityAdded(to, amountA, amountB, liquidity);

        return (amountA, amountB, liquidity);
    }

    /// @notice Calculate optimal amounts based on amounts desired and considering if tokenA is really token_A
    /// @param isTokenAIn bool that indicates if tokenA is really token_A
    /// @param amountADesired desired amount of token A
    /// @param amountBDesired desired amount of token B
    /// @param amountAMin minimum acceptable amount of token A
    /// @param amountBMin minimum acceptable amount of token B
    /// @return amountA amount of token A deposited
    /// @return amountB amount of token B deposited
    function _calculateOptimalAmounts(
        bool isTokenAIn,
        uint amountADesired,
        uint amountBDesired,
        uint amountAMin,
        uint amountBMin
    ) internal view returns (uint amountA, uint amountB) {
        uint _reserve_A = reserve_A;
        uint _reserve_B = reserve_B;
        uint desiredA = isTokenAIn ? amountADesired : amountBDesired;
        uint desiredB = isTokenAIn ? amountBDesired : amountADesired;
        uint minA = isTokenAIn ? amountAMin : amountBMin;
        uint minB = isTokenAIn ? amountBMin : amountAMin;

        if (_reserve_A == 0 && _reserve_B == 0) {
            amountA = desiredA;
            amountB = desiredB;
        } else {
            {
                uint optimalB = (desiredA * _reserve_B) / _reserve_A;
                if (optimalB <= desiredB) {
                    require(optimalB >= minB, "Insufficient B amount");
                    amountA = desiredA;
                    amountB = optimalB;
                } else {
                    uint optimalA = (desiredB * _reserve_A) / _reserve_B;
                    require(optimalA >= minA, "Insufficient A amount");
                    amountA = optimalA;
                    amountB = desiredB;
                }
            }
        }

        return (amountA, amountB);
    }

    /// @notice Removes liquidity and burns LQP tokens
    /// @dev emits the event {LiquidityRemoved}
    /// @param tokenA address of token A
    /// @param tokenB address of token B
    /// @param liquidity amount of LQP tokens to be burn
    /// @param amountAMin minimum acceptable amount of token A
    /// @param amountBMin minimum acceptable amount of token B
    /// @param to address receiving the tokens
    /// @param deadline timestamp to check if transaction is valid
    /// @return amountA amount of token A returned
    /// @return amountB amount of token B returned
    function removeLiquidity(
        address tokenA,
        address tokenB,
        uint liquidity,
        uint amountAMin,
        uint amountBMin,
        address to,
        uint deadline
    ) external returns (uint amountA, uint amountB) {
        require(block.timestamp <= deadline, "Transaction expired");
        require(to != address(0), "Invalid 'to' address");
        require(balanceOf(msg.sender) >= liquidity, "Not enough liquidity");

        address _token_A = token_A;
        address _token_B = token_B;

        require((tokenA == _token_A && tokenB == _token_B) || (tokenA == _token_B && tokenB == _token_A), "Invalid token pair");
        
        {
            uint _reserve_A = reserve_A;
            uint _reserve_B = reserve_B;
            uint internalAmountA;
            uint internalAmountB;
            
            {   
                uint _totalLiquidity = totalSupply();
                internalAmountA = (liquidity * _reserve_A) / _totalLiquidity;
                internalAmountB = (liquidity * _reserve_B) / _totalLiquidity;
            }
                      
            if (tokenA == _token_A) {
                amountA = internalAmountA;
                amountB = internalAmountB;
            } else {
                amountA = internalAmountB;
                amountB = internalAmountA;
            }

            require(amountA >= amountAMin && amountB >= amountBMin, "Slippage limit");

            reserve_A = _reserve_A - internalAmountA;
            reserve_B = _reserve_B - internalAmountB;
        }

        IERC20(tokenA).safeTransfer(to, amountA);
        IERC20(tokenB).safeTransfer(to, amountB);
        
        _burn(msg.sender, liquidity);
        emit LiquidityRemoved(to, amountA, amountB, liquidity);

        return(amountA, amountB);    
    }

    /// @notice Swaps an exact amount of input tokens for output tokens
    /// @dev emits the event {TokensSwapped}
    /// @param amountIn amount of input token to send
    /// @param amountOutMin minimum acceptable amount of output token
    /// @param path array with [tokenIn, tokenOut] addresses
    /// @param to address to receive the output token
    /// @param deadline timestamp to check if transaction is valid
    /// @return amounts array of token amounts [amountIn, amountOut]
    function swapExactTokensForTokens(
        uint amountIn,
        uint amountOutMin,
        address[] calldata path,
        address to,
        uint deadline
    ) external returns (uint[] memory amounts) {
        require(block.timestamp <= deadline, "Transaction expired");
        require(path.length == 2, "Invalid path length");
        require(to != address(0), "Invalid 'to' address");

        address _token_A = token_A;
        address _token_B = token_B;
        address tokenIn = path[0];
        address tokenOut = path[1];

        require((tokenIn == _token_A && tokenOut == _token_B) || (tokenIn == _token_B && tokenOut == _token_A), "Invalid tokens");

        uint amountOut;
        {
            uint _amountIn = amountIn;
            uint _amountOutMin = amountOutMin;
            bool isTokenAIn = tokenIn == _token_A;
            uint _reserve_A = reserve_A;
            uint _reserve_B = reserve_B;
            uint reserveIn = isTokenAIn ? _reserve_A : _reserve_B;
            uint reserveOut = isTokenAIn ? _reserve_B : _reserve_A;
            amountOut = (_amountIn * reserveOut) / (reserveIn + _amountIn);

            require(amountOut >= _amountOutMin, "Insufficient output amount");

            if (isTokenAIn) {
                reserve_A = _reserve_A + _amountIn;
                reserve_B = _reserve_B - amountOut;
            } else {
                reserve_B = _reserve_B + _amountIn;
                reserve_A = _reserve_A - amountOut;
            }
        }

        amounts = new uint[](2);
        amounts[0] = amountIn;
        amounts[1] = amountOut;

        IERC20(tokenIn).safeTransferFrom(msg.sender, address(this), amountIn);
        IERC20(tokenOut).safeTransfer(to, amountOut);
        emit TokensSwapped(msg.sender, tokenIn, tokenOut, amountIn, amountOut);
        return amounts;
    }

    /// @notice Returns the price of tokenA in terms of tokenB
    /// @param tokenA address
    /// @param tokenB address
    /// @return price price with 18 decimals (tokenB per tokenA)
    function getPrice(address tokenA, address tokenB) external view returns (uint price) {
        address _token_A = token_A;
        address _token_B = token_B;
        uint _reserve_A = reserve_A;
        uint _reserve_B = reserve_B;

        require((tokenA == _token_A && tokenB == _token_B) || (tokenA == _token_B && tokenB == _token_A), "Invalid tokens");
        require(_reserve_A > 0 && _reserve_B > 0, "No liquidity");

        bool isTokenAIn = tokenA == _token_A;
        uint numerator;
		uint denominator;

        if (isTokenAIn) {
            numerator = _reserve_B;
            denominator = _reserve_A;
        } else {
            numerator = _reserve_A;
            denominator = _reserve_B;
        }

        price = (numerator * 1e18) / denominator;

        return price;
    }

    /// @notice returns output amount for an input and reserve
    /// @param amountIn amount of input token
    /// @param reserveIn reserve of input token
    /// @param reserveOut reserve of output token
    /// @return amountOut token amount
    function getAmountOut(uint amountIn, uint reserveIn, uint reserveOut) public pure returns (uint amountOut) {
        require(amountIn > 0 && reserveIn > 0 && reserveOut > 0, "Invalid reserves or amount");

		uint numerator = amountIn * reserveOut;
		uint denominator = reserveIn + amountIn;
		amountOut = numerator / denominator;

        return amountOut;
    }
}