import { PScriptContext, Script, bool, bs, compile, makeRedeemerValidator, makeValidator, pBool, perror, pfn, pisEmpty, plet, pmatch, pserialiseData, pstruct } from "@harmoniclabs/plu-ts";

export const PolicyRedeemer = pstruct({
    Mint: {},
    Burn: {}
});

const validStakeNFTProofPolicy = pfn([
    PolicyRedeemer.type,
    PScriptContext.type
],  bool)
(( rdmr, ctx ) => {

    const ownCurrSym = plet(
        pmatch( ctx.purpose )
        .onMinting(({ currencySym }) => currencySym )
        ._( _ => perror( bs ) )
    );

    return pmatch( rdmr )
    .onMint( _ => {

        const fstIn = ctx.tx.inputs.head;

        const minted = plet( ctx.tx.mint.tail );

        const onlyTwoEntries = pisEmpty.$( minted.tail );

        const fstIsADA = ctx.tx.mint.head.fst.eq("");

        const ownEntry = plet( minted.head );

        const sndIsOwn = ownEntry.fst.eq( ownCurrSym );

        const assets = plet( ownEntry.snd );

        const singleMintedEntry = pisEmpty.$( assets.tail );

        const tokenMinted = plet( assets.head );

        const uniqueName = tokenMinted.fst.eq( pserialiseData.$( fstIn.utxoRef as any ) );

        const qty1 = tokenMinted.snd.eq( 1 );

        return onlyTwoEntries
        .and(  fstIsADA )
        .and(  sndIsOwn )
        .and(  singleMintedEntry )
        .and(  uniqueName )
        .and(  qty1 );
    })
    .onBurn( _ => ctx.tx.mint.some( entry =>
        entry.fst.eq( ownCurrSym )
        .and(
            entry.snd.every( asset => asset.snd.ltEq( 0 ) )
        ) 
    ));
});

export const validStakeNFTProofPolicyScript = new Script(
    "PlutusScriptV2",
    compile(
        makeRedeemerValidator(
            validStakeNFTProofPolicy
        )
    )
);