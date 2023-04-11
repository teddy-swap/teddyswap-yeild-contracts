import { PAddress, PCurrencySymbol, POutputDatum, PScriptContext, PTokenName, PValidatorHash, bool, data, int, pBSToData, pBool, pDataI, pIntToData, perror, pfn, phead, pisEmpty, plet, pmatch, pserialiseData, pstruct, punBData, punConstrData } from "@harmoniclabs/plu-ts";
import { DatumOrRdmr } from "./liquidityStakingContract";
import { pgetUpperCurrentTime } from "../utils/pgetCurrentTime";

const PStakeRequestDatum = pstruct({
    PStakeRequestDatum: {
        outToStakeContractIdx: int,
        address: PAddress.type,
        lpSym: PCurrencySymbol.type,
        lpName: PTokenName.type
    }
})

const PStakeRequestRedeemer = pstruct({
    Approve: {
        outToStakeContractIdx: int
    },
    Cancel: {} 
});

const stakeRequestContract = pfn([
    PValidatorHash.type,
    PCurrencySymbol.type,
    PStakeRequestDatum.type,
    PStakeRequestRedeemer.type,
    PScriptContext.type
],  bool)
(( 
    stakeContractValHash,
    validStakeNFTProofPolicy,
    datum, rdmr, ctx
) => {

    const { tx } = ctx;

    const { address: ownerAddress, lpName, lpSym } = datum; 

    return pmatch( rdmr )
    .onCancel( _ => // tx signed by who created the stake request
        plet(
            // extract signer without matching constructor
            // if it is a validator hash will fail anyway
            // since validator hashes are not included in the `signatories` field
            punBData.$(
                phead( data ).$(
                    ownerAddress.credential.raw.fields
                )
            )
        ).in( ownerHash => 
            tx.signatories.some( ownerHash.eqTerm )
        )
    )
    .onApprove(({ outToStakeContractIdx }) => {

        const outGoingToStake = plet(
            tx.outputs.at( outToStakeContractIdx )
        );

        const correctOutDatum = outGoingToStake.datum.eq(
            POutputDatum.InlineDatum({
                datum: DatumOrRdmr.StakingDatum({
                    ownerAddr: ownerAddress as any,
                    since: pIntToData.$( pgetUpperCurrentTime.$( tx.interval ) ),
                    lpName: pBSToData.$( lpName ),
                    lpSym:  pBSToData.$( lpSym  ),
                }) as any
            })
        );

        const outGoingToStakeValidator = 
            pmatch( outGoingToStake.address.credential )
            .onPScriptCredential(({ valHash: outValHash }) => outValHash.eq( stakeContractValHash ) )
            ._( _ => perror( bool ) )

        // output going to stake contract is marked with NFT
        const outContainsMintedNFT = plet( tx.mint.tail ).in( noADAValue =>

            // the minted value (ADA excluded) only contains 1 policy
            pisEmpty.$( noADAValue.tail )
            .and(
                // first policy is ADA
                // (every on-chain value has ADA)
                tx.mint.head.fst.eq("")
            )
            .and(

                plet(
                    noADAValue.head
                ).in( validStakeNFTProofEntry => 
                    // the minted assets are from a known policy
                    validStakeNFTProofEntry.fst.eq( validStakeNFTProofPolicy )
                    .and(

                        // we perform here the minting validation
                        // because we want to be 100% sure that the minted token is unique
                        plet(
                            validStakeNFTProofEntry.snd
                        ).in( validStakeNFTProofAssets =>

                            // single asset minted
                            pisEmpty.$( validStakeNFTProofAssets.tail ) 
                            .and(
                                plet( validStakeNFTProofAssets.head )
                                .in( validStakeNFTProofAsset =>

                                    validStakeNFTProofAsset.fst.eq(
                                        
                                        // asset name is the CBOR-serialized format
                                        // of the first input of this transaction.
                                        pserialiseData.$( tx.inputs.head.utxoRef as any )

                                    )
                                    .and(
                                        // quantity is 1
                                        validStakeNFTProofAsset.snd.eq( 1 )
                                    )
                                )
                            )

                        )
                    )
                )

            )
            .and(
                outGoingToStake.value.some( entry => entry.fst.eq( validStakeNFTProofPolicy ) )
            )

        );

        return correctOutDatum
        .and(  outGoingToStakeValidator )
        .and(  outContainsMintedNFT     );
    })
})