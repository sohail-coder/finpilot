import { useEffect, useState } from "react";
import { GoogleLogin, GoogleOAuthProvider } from "@react-oauth/google";
import { fetchGoogleClientId } from "../lib/api";
import { getViteGoogleClientId } from "../lib/googleAuth";

type Props = {
  onSuccess: (credential: string) => void;
  onError: (message: string) => void;
};

export default function GoogleSignInButton({ onSuccess, onError }: Props) {
  const [clientId, setClientId] = useState<string | null>(() =>
    getViteGoogleClientId(),
  );

  useEffect(() => {
    if (clientId) return;
    fetchGoogleClientId()
      .then((id) => {
        if (id) setClientId(id);
      })
      .catch(() => setClientId(null));
  }, [clientId]);

  if (!clientId) {
    return (
      <div className="flex h-11 items-center justify-center text-sm text-gray-400">
        Loading Google sign-in…
      </div>
    );
  }

  return (
    <GoogleOAuthProvider clientId={clientId}>
      <div className="flex justify-center">
        <GoogleLogin
          onSuccess={(credentialResponse) => {
            if (credentialResponse.credential) {
              onSuccess(credentialResponse.credential);
            }
          }}
          onError={() => onError("Google sign-in failed.")}
          width="380"
          text="continue_with"
          shape="rectangular"
          size="large"
        />
      </div>
    </GoogleOAuthProvider>
  );
}
