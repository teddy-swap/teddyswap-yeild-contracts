import { PCurrencySymbol, PPubKeyHash, PScriptContext, bool, bs, data, perror, pfn, pif, pisEmpty, plet, pmakeUnit, pmatch, unit } from "@harmoniclabs/plu-ts";

export const validRewardNFT = pfn([
    PPubKeyHash.type,
    data, // any redeemer
    PScriptContext.type
],  unit )
(( botPkh, _rdmr, ctx ) => {
    
    const ownHash = plet(
        pmatch( ctx.purpose )
        .onMinting( ({ currencySym }) => currencySym )
        ._( _ => perror( bs ) )
    );

    // inlined
    const burning = ctx.tx.mint.some( ({ fst: policy, snd: assets }) =>
        policy.eq( ownHash )
        .and(
            pisEmpty.$( assets.tail )
            .and(
                assets.head.snd.lt( 0 )
            )
        )
    );

    // inlined
    const correctMint = ctx.tx.mint.some( ({ fst: policy, snd: assets }) =>
        policy.eq( ownHash )
        .and(
            // single entry
            pisEmpty.$( assets.tail )
            // empty asset name
            .and( assets.head.fst.eq("") )
            // as many as needed
        )
    );

    // inlined
    const minting =
    ctx.tx.signatories.some( botPkh.eqTerm )
    .and( correctMint )

    return pif( unit ).$(
        burning.or( minting )
    )
    .then( pmakeUnit() )
    .else( perror( unit ) )
})