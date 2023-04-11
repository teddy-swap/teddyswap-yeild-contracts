import { PCurrencySymbol, PScriptContext, PTxOutRef, Script, Term, V2, bool, compile, makeRedeemerValidator, pBool, perror, pfn, pisEmpty, plet, pmatch, pstruct } from "@harmoniclabs/plu-ts";

export const MintRdmr = pstruct({
    Mint: {},
    Burn: {}
});

const oneShotNFTContract = pfn([
    PTxOutRef.type,

    MintRdmr.type,
    PScriptContext.type

],  bool)
(( utxo, rdmr, ctx ) => {
    
    const { tx, purpose } = ctx;

    const ownCurrSym = plet(
        pmatch( purpose )
        .onMinting(({ currencySym }) => currencySym )
        ._( _ => perror( PCurrencySymbol.type ) as any )
    )

    return pmatch( rdmr )
    .onMint( _ => {

        const spendingRequriedUtxo = tx.inputs.some( _in => _in.utxoRef.eq( utxo ) );

        
        const uniqueAsset = tx.mint.some( entry => {
            
            const assets = plet( entry.snd );

            return entry.fst.eq( ownCurrSym )
            .and(
                pisEmpty.$( assets.tail )
                .and(
                    assets.head.snd.eq( 1 )
                )
            )
        });

        return spendingRequriedUtxo
        .and(  uniqueAsset );
    })
    .onBurn( _ =>
        tx.mint.some( entry => {

            const assets = plet( entry.snd );

            return entry.fst.eq( ownCurrSym )
            .and(
                pisEmpty.$( assets.tail )
                .and(
                    assets.head.snd.lt( 0 )
                )
            )
        }) 
    );
})

export const mkOneShotNFT = ( mustSpend: Term<typeof PTxOutRef>) => new Script(
    "PlutusScriptV2",
    compile(
        makeRedeemerValidator(
            oneShotNFTContract.$( mustSpend )
        )
    )
);