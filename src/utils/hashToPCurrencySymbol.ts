import { Hash28, PAsData, PCurrencySymbol, Term, pByteString, toData } from "@harmoniclabs/plu-ts";

export function hashToPCurrencySymbol( hash: Hash28 ): Term<PAsData<typeof PCurrencySymbol>>
{
    return toData( PCurrencySymbol.type )( PCurrencySymbol.from( hash.asString ) );
}