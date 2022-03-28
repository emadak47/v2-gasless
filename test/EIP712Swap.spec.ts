import chai, { expect } from 'chai'
import { solidity, MockProvider, createFixtureLoader } from 'ethereum-waffle'
import { Contract } from 'ethers'
import { BigNumber, bigNumberify, Interface } from 'ethers/utils'
import { AddressZero, Zero, MaxUint256 } from 'ethers/constants'

import UniSwapV2Router02 from '../build/UniswapV2Router02.json';
import EIP712MetaTransaction from '../build/EIP712MetaTransaction.json';

import { v2Fixture } from './shared/fixtures'
import { expandTo18Decimals, getFunctionSignature, getTransactionData } from './shared/utilities'

chai.use(solidity)

const overrides = {
    gasLimit: 9999999
}

enum RouterVersion {
    UniswapV2Router02 = 'UniswapV2Router02'
}

describe('EIP712SwapTest', () => {
    for (const routerVersion of Object.keys(RouterVersion)) {
        const provider = new MockProvider({
            hardfork: 'istanbul',
            mnemonic: 'horn horn horn horn horn horn horn horn horn horn horn horn',
            gasLimit: 9999999
        });
        const [wallet, user, receiver] = provider.getWallets();
        const loadFixture = createFixtureLoader(provider, [wallet]);

        let token0: Contract;
        let token1: Contract;
        let router: Contract;
        let pair: Contract;

        beforeEach(async function () {
            const fixture = await loadFixture(v2Fixture);
            token0 = fixture.token0;
            token1 = fixture.token1;
            router = {
                [RouterVersion.UniswapV2Router02]: fixture.router02,
            }[routerVersion as RouterVersion];
            pair = fixture.pair;
        });

        afterEach(async function () {
            expect(await provider.getBalance(router.address)).to.eq(Zero);
        });

        describe(routerVersion, () => {
            async function addLiquidity(token0Amount: BigNumber, token1Amount: BigNumber) {
                await token0.transfer(pair.address, token0Amount);
                await token1.transfer(pair.address, token1Amount);
                await pair.mint(user.address, overrides);
            }

            describe('Swap - MetaTransaction', () => {
                const token0Amount = expandTo18Decimals(5);
                const token1Amount = expandTo18Decimals(10);
                const swapAmount = expandTo18Decimals(1);

                beforeEach(async () => {
                    await addLiquidity(token0Amount, token1Amount);
                    await token0.approve(router.address, MaxUint256);
                    await token0.approve(wallet.address, MaxUint256);
                });

                it('should swap successfully', async () => {
                    /**
                     * 1. encode router function 'e.x. swapExactTokensForTokens' with params
                     * 2. retrieve { r, s, v, ..} from signed data 
                     */
                    const nonce = await router.getNonce(user.address);
                    const uniSwapV2RouterInterface: Interface = new Interface(UniSwapV2Router02.abi);
                    const { r, s, v, functionSignature } = getTransactionData(
                        nonce,
                        user,
                        uniSwapV2RouterInterface.functions.swapExactTokensForTokens,
                        [
                            swapAmount,
                            Zero,
                            [token0.address, token1.address],
                            receiver.address,
                            MaxUint256
                        ],
                        router.address // verfyingContract
                    );

                    // Method 1
                    // encode function 'executeMetaTransaction' with params
                    // send raw tx with signer 'i.e. wallet'

                    // const EIP712MetaTxInterface: Interface = new Interface(EIP712MetaTransaction.abi);
                    // const data = getFunctionSignature(
                    //     EIP712MetaTxInterface.functions.executeMetaTransaction, 
                    //     [
                    //         user.address,
                    //         functionSignature,
                    //         r,
                    //         s,
                    //         v
                    //     ]
                    // );
                    // const tx1 = await router.signer.sendTransaction({
                    //     from: wallet.address, // signer
                    //     gasLimit: bigNumberify(9999999),
                    //     data: data,
                    //     value: bigNumberify(1)
                    // });
                    // const receipt1 = await tx1.wait();
                    // console.log(receipt1);

                    // ***************************************************************************

                    // Method 2
                    // connect signer 'wallet' and call function 'executeMetaTransaction' directly 
                    // reverts with: Function call not successfull 

                    // const tx2 = await router.connect(wallet).executeMetaTransaction(
                    //     user.address,
                    //     functionSignature,
                    //     r,
                    //     s,
                    //     v
                    // );
                    // const receipt2 = await tx2.wait();
                    // console.log(receipt2);
                });
            });
        });
    }
});