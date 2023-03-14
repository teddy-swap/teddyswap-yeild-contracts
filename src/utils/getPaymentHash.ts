import { phoist, plam, PCredential, bs, punBData, punConstrData, PAddress } from "@harmoniclabs/plu-ts";

export const getCredentialHash = phoist(
    plam( PCredential.type, bs )
    ( creds =>
        punBData.$(
            punConstrData.$( creds as any ).snd.head 
        )
    )
)

export const getPaymentHash = phoist(
    plam( PAddress.type, bs )
    ( addr => addr.extract("credential")
        .in( ({ credential }) => getCredentialHash.$( credential ) )
    )
);