import {
    RPCSubprovider,
    Web3ProviderEngine,
    ContractWrappers,
    BigNumber,
} from '0x.js'
import { providerUtils } from '@0x/utils';
import { Web3Wrapper } from '@0x/web3-wrapper';
import { MnemonicWalletSubprovider } from '@0x/subproviders'
import { SwapQuoteConsumer, SwapQuoter, ConsumerType } from '@0x/asset-swapper';

import * as LiquidityRequiringContractArtifact from '../generated-artifacts/LiquidityRequiringContract.json';
import { LiquidityRequiringContractContract } from '../generated-wrappers/liquidity_requiring_contract';

const RPC_URL = 'https://kovan.infura.io/v3/502999b3f7d54f00a6677f86660ffb94';
const MNEMONIC = 'warfare barrel polar small credit alert picnic innocent measure honey tape hair';
const SRA_URL = 'https://api.kovan.radarrelay.com/0x/v2/'
const ZRX_KOVAN_ADDRESS = '0x2002d3812f58e35f0ea1ffbf80a75a38c32175fa';
const ONE_TOKEN =  Web3Wrapper.toBaseUnitAmount(new BigNumber(1), 18);

const setupContractsAsync = async (web3Wrapper: Web3Wrapper, wrapper: ContractWrappers) => {
    const provider = web3Wrapper.getProvider();
    const accounts = await web3Wrapper.getAvailableAddressesAsync();
    // Deploy our liquidity consuming contract
    const contract = await LiquidityRequiringContractContract.deployAsync(
        LiquidityRequiringContractArtifact.compilerOutput.evm.bytecode.object,
        LiquidityRequiringContractArtifact.compilerOutput.abi,
        provider,
        { 
            from: accounts[0],
        },
        {},
        wrapper.forwarder.address,
    );
    return { contract, wrapper };
}

const getProvider = (): Web3ProviderEngine  => {
    const mnemonicWalletProvider = new MnemonicWalletSubprovider({
        mnemonic: MNEMONIC 
    });
    const providerEngine = new Web3ProviderEngine();
    const rpcProvider = new RPCSubprovider(RPC_URL)
    providerEngine.addProvider(mnemonicWalletProvider);
    providerEngine.addProvider(rpcProvider);
    providerUtils.startProviderEngine(providerEngine);
    return providerEngine;
}

const providerEngine = getProvider();

(async () => {
    const web3Wrapper = new Web3Wrapper(providerEngine);
    const accounts = await web3Wrapper.getAvailableAddressesAsync();
    console.log(accounts[0])
    const provider = web3Wrapper.getProvider();
    const networkId = await web3Wrapper.getNetworkIdAsync();
    const wrapper = new ContractWrappers(provider, { networkId });
    const { contract } = await setupContractsAsync(web3Wrapper, wrapper);
    const wethAddress = wrapper.weth9.address;
    const zrxAddress = ZRX_KOVAN_ADDRESS;

    const swapQuoter = SwapQuoter.getSwapQuoterForStandardRelayerAPIUrl(provider, SRA_URL, {
        networkId,
    });

    const quote = await swapQuoter.getMarketBuySwapQuoteAsync(zrxAddress, wethAddress, ONE_TOKEN)

    console.log('Attempting to purchase:');
    console.log('amount of maker token:', ONE_TOKEN);
    console.log('for')
    console.log('amount of taker token:', quote.worstCaseQuoteInfo.takerTokenAmount)

    const swapQuoteConsumer = new SwapQuoteConsumer(provider, {
        networkId,
    })

    const { calldataHexString } = await swapQuoteConsumer.getCalldataOrThrowAsync(quote, {
        useConsumerType: ConsumerType.Forwarder,
    });
    
    // const txHash = await web3Wrapper.sendTransactionAsync({
    //     from: accounts[0],
    //     to: wrapper.forwarder.address,
    //     value: quote.worstCaseQuoteInfo.takerTokenAmount,
    //     data: calldataHexString,
    // });
    // console.log('transaction submitted:', txHash)
    
    const fillResults = await contract.liquidityRequiringFunctionBytes.callAsync(calldataHexString);
    console.log('FillResults', fillResults);
    
    // Fill the orders via the contract
    const txHash = await contract.liquidityRequiringFunctionBytes.sendTransactionAsync(calldataHexString, {
        value: quote.worstCaseQuoteInfo.takerTokenAmount
    });

    console.log('transaction submitted:', txHash)
    await web3Wrapper.awaitTransactionSuccessAsync(txHash);

    await swapQuoter.destroyAsync();

    // Contract can now fill orders with DAI and has a DAI balance

    // Get an SwapQuoter with orders for usdc/dai
    // Normally this would connect to an SRA endpoint or another order provider
    // let swapQuoter, quote, fillResults, txHash;
    // swapQuoter = await utils.assetSwapperWithOrdersAsync(
    //     addresses.exchange,
    //     web3Wrapper.getProvider(),
    //     usdc.address,
    //     dai.address,
    // );
    // // Get a quote for 500 USDC, liquidityRequiringFunction determines the correct amount to fill
    // // at transaction execution time, but has enough orders to fill 500 USDC
    // console.log('liquidityRequiringFunction');
    // // Create a quote buying 500 USDC using dai
    // quote = await swapQuoter.getMarketBuySwapQuoteAsync(usdc.address, dai.address, new BigNumber(500));
    // console.log('Quote', quote);
    // const consumer = new SwapQuoteConsumer(web3Wrapper.getProvider());

    // // Get the orders and the signatures to fulfill the quote
    // const contractParams = await consumer.getSmartContractParamsOrThrowAsync(quote, { takerAddress: contract.address });
    // const { orders, signatures } = contractParams.params;

    // // Perform call to ensure the transaction is successful
    // fillResults = await contract.liquidityRequiringFunction.callAsync(orders, signatures);
    // console.log('FillResults', fillResults);
    // // Fill the orders via the contract
    // txHash = await contract.liquidityRequiringFunction.sendTransactionAsync(orders, signatures);
    // await web3Wrapper.awaitTransactionSuccessAsync(txHash);

    // // Fill the Orders by executing the call generated via asset swapper.
    // // This call includes the amount (500) in the call data
    // console.log('liquidityRequiringFunctionBytes');
    // swapQuoter = await utils.assetSwapperWithOrdersAsync(
    //     addresses.exchange,
    //     web3Wrapper.getProvider(),
    //     usdc.address,
    //     dai.address,
    // );
    // // Create a quote buying 500 USDC using dai
    // quote = await swapQuoter.getMarketBuySwapQuoteAsync(usdc.address, dai.address, new BigNumber(500));
    // // Fill using liquidityRequiringFunctionBytes
    // const { calldataHexString } = await consumer.getCalldataOrThrowAsync(quote, { takerAddress: contract.address });
    // // Perform call to ensure the transaction is successful
    // fillResults = await contract.liquidityRequiringFunctionBytes.callAsync(calldataHexString);
    // console.log('FillResults', fillResults);
    // // Fill the orders via the contract
    // txHash = await contract.liquidityRequiringFunctionBytes.sendTransactionAsync(calldataHexString);
    // await web3Wrapper.awaitTransactionSuccessAsync(txHash);
})().catch(e => console.log(e));


