import { PAddress, PBool, PByteString, PCurrencySymbol, POutputDatum, PScriptContext, PScriptPurpose, PTokenName, PTxInInfo, PTxInfo, PTxOut, PTxOutRef, PUnit, PValidatorHash, Script, Term, TermFn, UtilityTermOf, bool, bs, compile, data, fn, int, list, pBSToData, pBool, pByteString, pIntToData, peqBs, perror, pfn, phead, pif, pisEmpty, plam, plet, pmakeUnit, pmatch, precursive, pserialiseData, pstruct, punBData, punConstrData, punsafeConvertType, unit } from "@harmoniclabs/plu-ts";
import { getPaymentHash } from "../utils/getPaymentHash";
import { pvalueOf } from "../utils/PValue/pvalueOf";
import { PReserveDatum } from "./tedyYeildReserve";
import { pgetLowerCurrentTime, pgetUpperCurrentTime } from "../utils/pgetCurrentTime";
import { getOutCreds } from "../utils/getOutCreds";

export const DatumOrRdmr = pstruct({
    StakingDatum: {
        ownerAddr: PAddress.type,
        since: int,
        lpSym: PCurrencySymbol.type,
        lpName: PTokenName.type
    },
    MintRedeemer: {
        outToStakeContractIdx: int,
        address: PAddress.type,
        lpSym: PCurrencySymbol.type,
        lpName: PTokenName.type
    }
});

const RdmrOrCtx = pstruct({
    // MUST be the first constructor
    CtxLike: {
        tx: PTxInfo.type,
        purpose: PScriptPurpose.type
    },
    /**
     * also allows for lq deposits / withdraws
    **/
    Harvest: {
        /**
         * since we perform auto-harvest calculation at withdraw
         * is possible that if the staked utxo has been here for long time
         * calculation will exceed cpu limits
         * 
         * as a workaround we introduce the possibility to withdraw up to a certain point in time
         * so that it can still be processed with two or more transactions
         * in the case explained above
        **/
        upToTime: int
    }
});

const validateIO_t = fn([
    int, // minTime
    list( PTxInInfo.type ),
    list( PTxOut.type )
],  bool);

const untyped_liquidityStakingContract = pfn([
    PValidatorHash.type,
    // PCurrencySymbol.type,
    PCurrencySymbol.type,
    PTokenName.type,
    DatumOrRdmr.type,
    RdmrOrCtx.type,
    // PScriptContext.type
],  unit)
(( 
    reserveValHash,
    // ownHash,
    TEDY_policy,
    TEDY_tokenName,
    datum_or_rdmr, rdmr_or_ctx //, ctx
) => 
    pmatch( rdmr_or_ctx )
    // used as minting policy
    .onCtxLike( ctx => 
        // using `plet().in()` because we don't want this to be hoisted
        plet(
            pmatch( ctx.purpose )
            .onMinting(({ currencySym }) => currencySym )
            ._( _ => perror( bs ) )
        )
        .in( ownHash => 
            pmatch( datum_or_rdmr )
            .onStakingDatum(_ => perror( unit ) )
            .onMintRedeemer( rdmr => {

                const { tx } = ctx;

                const {
                    address: ownerAddress, 
                    lpName, 
                    lpSym, 
                    outToStakeContractIdx 
                } = rdmr; 
    
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
                    .onPScriptCredential(({ valHash: outValHash }) => outValHash.eq( ownHash ) )
                    ._( _ => perror( bool ) );

                const fstIn = ctx.tx.inputs.head;

                const minted = plet( ctx.tx.mint.tail );

                const onlyTwoEntries = pisEmpty.$( minted.tail );

                const fstIsADA = ctx.tx.mint.head.fst.eq("");

                const ownEntry = plet( minted.head );

                const sndIsOwn = ownEntry.fst.eq( ownHash );

                const assets = plet( ownEntry.snd );

                const singleMintedEntry = pisEmpty.$( assets.tail );

                const tokenMinted = plet( assets.head );

                const uniqueName = tokenMinted.fst.eq( pserialiseData.$( fstIn.utxoRef as any ) );

                const qty1 = tokenMinted.snd.eq( 1 );

                const correctMint = onlyTwoEntries
                .and(  fstIsADA )
                .and(  sndIsOwn )
                .and(  singleMintedEntry )
                .and(  uniqueName )
                .and(  qty1 );

                // output going to stake contract is marked with NFT
                const outContainsMintedNFT = outGoingToStake.value.some( entry => entry.fst.eq( ownHash ) );

                return pif( unit ).$(
                    correctOutDatum
                    .and(  outGoingToStakeValidator )
                    .and(  correctMint )
                    .and(  outContainsMintedNFT     )
                )
                .then( pmakeUnit() )
                .else( perror( unit ) );
            })
        )
    )
    // used as validator
    .onHarvest( ({ upToTime }) =>
    /**
     * we are using the contract as validator here;
     * that means that we expect an other argument from the node (the context)
     * 
     * however `plu-ts` will check for the type to be `unit`
     * 
     * so we use a little hack here to compile the contract
    **/
    punsafeConvertType(
        plam( PScriptContext.type, unit )
        ( ctx =>
            pmatch( datum_or_rdmr )
            .onMintRedeemer( _ => perror( unit ) )
            // unwrap
            .onStakingDatum( stakingInfos => 
            
            // using `plet().in()` because we don't want this to be hoisted
            plet(
                pmatch( ctx.purpose )
                .onSpending(({ utxoRef }) => utxoRef )
                ._( _ => perror( PTxOutRef.type ) )
            ).in( ownUtxoRef => {
    
                const { tx } = ctx;
            
                const isReserveValHash = plet( peqBs.$( reserveValHash ) )
            
                // tx input at position 0 MUST be the one being validated by the contract
                const ownInInfos = plet( tx.inputs.head );
                const ownInput = ownInInfos.resolved;
                const ownInputRef = ownInInfos.utxoRef;
            
                const currTime = plet(
                    pgetLowerCurrentTime.$( tx.interval )
                );
                
                const finalTime = plet(
                    pif( int ).$( currTime.ltEq( upToTime ) )
                    .then( currTime )
                    .else( upToTime )
                );
            
                const fstOut = plet( tx.outputs.head ); 
            
                const validateReserveOuts = plet(
                    mkValidateIO(
                        isReserveValHash,
                        stakingInfos.lpSym,
                        stakingInfos.lpName,
                        TEDY_policy,
                        TEDY_tokenName
                    )
                    // in both case these are the first three inputs
                    // so we partially apply
                    .$( 
                        pvalueOf
                        .$( ownInput.value )
                        .$(stakingInfos.lpSym)
                        .$(stakingInfos.lpName)
                    )
                    .$( finalTime )
                    .$( stakingInfos.since )
                    .$( tx.inputs.tail )
                );
            
                // input ar position 0 is actually the one being vaidated
                const fstInputIsOwn = ownInputRef.eq( ownUtxoRef );
    
                const ownHash = plet(
                    punBData.$(
                        phead( data ).$(
                            getOutCreds.$( ownInput ).raw.fields
                        )
                    )
                )
                // input is certified (aka, the datum is trusted)
                // if the value contains a predefined NFT
                const ownInputIsCertified = ownInput.value.some( entry => entry.fst.eq( ownHash ) );
            
                const fstOutGoingBackHere = fstOut.address.eq( ownInput.address ) 
            
                // if lp still staked
                const nftStaysHere = 
                    // nft going back here
                    fstOut.value.some( entry =>  entry.fst.eq( ownHash ) );
            
                const onlySinceFieldUpdated = fstOut.datum.eq(
                    POutputDatum.InlineDatum({
                        datum: DatumOrRdmr.StakingDatum({
                            ownerAddr: stakingInfos.ownerAddr as any, // same owner address
                            since:  pIntToData.$( finalTime ), // updated with this withraw timestamp
                            lpSym:  pBSToData.$( stakingInfos.lpSym  ), // same lpSym  
                            lpName: pBSToData.$( stakingInfos.lpName )  // same lpName 
                        }) as any
                    })
                );
                
                // to use if the first is going back here
                const sndOutToOwner = tx.outputs.tail.head.address.eq( stakingInfos.ownerAddr );
            
                // to use if the lp tokens are 100% withdrawn
                const fstOutToOwner = fstOut.address.eq( stakingInfos.ownerAddr );
            
                const burnedCertifyngNFT = tx.mint.some( entry => 
                    entry.fst.eq( ownHash )
                    .and(
                        entry.snd.every( asset =>
                            asset.snd.lt( 0 ) // burning 
                        )
                    )
                );
            
                const validIO = // if fistOut going back to this contract
                pif( bool ).$( fstOutGoingBackHere )
                .then(
                    sndOutToOwner
                    .and( nftStaysHere )
                    .and( onlySinceFieldUpdated )
                    .and(
                        validateReserveOuts
                        .$( tx.outputs.tail.tail )
                    )
                )
                .else(
                    // if not back here then the first output is the one going to the user
                    fstOutToOwner
                    // since nothing is going back here we must be sure we are burning the NFT
                    .and( burnedCertifyngNFT )
                    // checks for datums
                    .and(
                        validateReserveOuts
                        .$( tx.outputs.tail )
                    )
                );
    
                return pif( unit ).$(
                    fstInputIsOwn
                    .and( ownInputIsCertified )
                    .and( validIO )
                )
                .then( pmakeUnit() )
                .else( perror( unit ) );
            }))
        ),
        unit
    ))
);


export const mkStakingContract = ( reserveValHash: Term<typeof PValidatorHash> ) => new Script(
    "PlutusScriptV2",
    compile(
        untyped_liquidityStakingContract.$( reserveValHash )
    )
);



/**
 * all the inputs from `1` to `n` MUST be from the reserve
 * and MUST be sorted by reward epoch
 * 
 * we need to validate tx inputs and outputs together
 * because each input from the reserve 
 * must go back to the reserve (unless drained)
 * 
 * so we write a custom loop instead of using something like `precursiveList`
**/
function mkValidateIO(
    isReserveValHash: TermFn<[ PByteString ], PBool>,
    thisLpSym : UtilityTermOf<typeof PCurrencySymbol>,
    thisLpName: UtilityTermOf<typeof PTokenName>,
    rewardsTokenSym : UtilityTermOf<typeof PCurrencySymbol>,
    rewardsTokenName: UtilityTermOf<typeof PTokenName>,
)
{

    return pfn([ int, int ], validateIO_t )
    ( ( userStakedLp, upToTime ) => 
        precursive(
            pfn([
                validateIO_t,
                int,
                list( PTxInInfo.type ),
                list( PTxOut.type )
            ],  bool)
            (( self, minTime, inputs, outputs ) => {

                const input = plet( inputs.head.resolved );
                const output = plet( outputs.head );

                const inDatum = plet(
                    pmatch( input.datum )
                    .onInlineDatum(({ datum }) => punsafeConvertType( datum, PReserveDatum.type ) )
                    ._( _ => perror( PReserveDatum.type ) )
                );

                const outDatum = plet(
                    pmatch( output.datum )
                    .onInlineDatum( ({ datum }) => punsafeConvertType( datum, PReserveDatum.type ) )
                    ._( _ => perror( PReserveDatum.type ) )
                );
    
                const meantForThisLpToken =
                    inDatum.lpTokenCurrSym.eq( thisLpSym )
                    .and( inDatum.lpTokenName.eq( thisLpName ) );
    
                const inputFromReserve = isReserveValHash.$( getPaymentHash.$( input.address ) );
                const outputToReserve = isReserveValHash.$( getPaymentHash.$( output.address ) ); 

                const reserveDatumUnchanged = input.datum.eq( output.datum );
    
                const correctTime =
                    inDatum.time.eq( minTime )
                    .and( outDatum.time.eq( minTime ) );
                        
                const outputRewards = pvalueOf.$( output.value ).$( rewardsTokenSym ).$( rewardsTokenName );

                const correctRewards = 
                    outputRewards
                    .eq(
                        plet(
                            pvalueOf.$( input.value ).$( rewardsTokenSym ).$( rewardsTokenName )
                        ).in( inputRewards =>
                            inputRewards.sub(
                                inputRewards.mult( userStakedLp ).div( inDatum.totStakedSupply )
                            )
                        )
                    );

                return meantForThisLpToken
                .and(  inputFromReserve )
                .and(  outputToReserve )
                .and(  reserveDatumUnchanged )
                .and(  correctTime )
                .and(  correctRewards )
                .and(
                    pif( bool ).$( pisEmpty.$( inputs.tail ) )
                    .then( inDatum.time.eq( upToTime ) )
                    .else(
                        self
                        .$( minTime.add( 1 ) )
                        .$( inputs.tail )
                        .$( outputs.tail )
                    )
                );
            })
        )
    );
}