import { phoist, plam, PCredential, bs, punBData, PAddress, phead, data } from "@harmoniclabs/plu-ts";

export const getCredentialHash = phoist(
    plam( PCredential.type, bs )
    ( creds =>
        punBData.$(
            phead( data ).$(
                creds.raw.fields
            )
        )
    )
)

export const getPaymentHash = phoist(
    plam( PAddress.type, bs )
    ( addr => getCredentialHash.$( addr.credential )
    )
);