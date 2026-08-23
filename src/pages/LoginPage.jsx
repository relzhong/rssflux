import { useEffect, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { authState, login } from "@/stores/authStore";
import {
  Button,
  FieldError,
  Form,
  Input,
  InputGroup,
  Label,
  Spinner,
  TextField,
} from "@heroui/react";
import { Eye, EyeClosed, RefreshCw, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { useStore } from "@nanostores/react";
import { useTranslation } from "react-i18next";

export default function LoginPage() {
  const navigate = useNavigate();
  const $auth = useStore(authState);
  const { t } = useTranslation();

  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [captcha, setCaptcha] = useState("");
  const [captchaChallenge, setCaptchaChallenge] = useState({ id: "", image: "" });
  const [captchaLoading, setCaptchaLoading] = useState(false);
  const [isVisible, setIsVisible] = useState(false);
  const [loading, setLoading] = useState(false);

  const fetchCaptcha = useCallback(async () => {
    setCaptchaLoading(true);
    try {
      const res = await fetch("/api/auth/captcha");
      if (res.ok) {
        const data = await res.json();
        setCaptchaChallenge(data);
        setCaptcha("");
      }
    } catch (err) {
      console.error("Failed to load captcha:", err);
    } finally {
      setCaptchaLoading(false);
    }
  }, []);

  useEffect(() => {
    if ($auth.isAuthenticated) {
      navigate("/");
    }
  }, [$auth.isAuthenticated, navigate]);

  useEffect(() => {
    fetchCaptcha();
  }, [fetchCaptcha]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      await login(username, password, captchaChallenge.id, captcha);
      navigate("/");
    } catch (err) {
      toast.error(err.message || "Invalid credentials or captcha");
      // Always refresh captcha after attempt
      fetchCaptcha();
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center p-4 bg-background">
      <div className="w-full max-w-sm flex flex-col gap-6 p-6 bg-transparent">
        <div className="flex flex-col gap-1 items-center text-center">
          <div className="size-12 rounded-2xl bg-accent/10 flex items-center justify-center text-accent mb-2">
            <ShieldCheck className="size-6" />
          </div>
          <h1 className="text-2xl font-semibold tracking-tight">
            {t("auth.login") || "Login"}
          </h1>
          <p className="text-xs text-muted">
            Nextflux Fastify BFF Protected Instance
          </p>
        </div>

        <Form
          className="flex flex-col gap-4"
          validationBehavior="native"
          onSubmit={handleSubmit}
        >
          <TextField isRequired name="username">
            <Label>{t("auth.username") || "Username"}</Label>
            <Input
              placeholder={t("auth.usernamePlaceholder") || "Enter username"}
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="w-full"
              autoComplete="username"
            />
            <FieldError />
          </TextField>

          <TextField isRequired name="password">
            <Label>{t("auth.password") || "Password"}</Label>
            <InputGroup>
              <InputGroup.Input
                placeholder={t("auth.passwordPlaceholder") || "Enter password"}
                type={isVisible ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full"
                autoComplete="current-password"
              />
              <InputGroup.Suffix>
                <button
                  type="button"
                  onClick={() => setIsVisible(!isVisible)}
                  aria-label="Toggle password visibility"
                  className="p-1 hover:text-foreground text-muted"
                >
                  {isVisible ? (
                    <EyeClosed className="size-4" />
                  ) : (
                    <Eye className="size-4" />
                  )}
                </button>
              </InputGroup.Suffix>
            </InputGroup>
            <FieldError />
          </TextField>

          <div className="flex flex-col gap-2">
            <Label>{t("auth.captcha") || "Verification Code"}</Label>
            <div className="flex items-center gap-2">
              <div
                className="h-12 w-40 rounded-lg overflow-hidden border border-foreground/10 bg-default/40 flex items-center justify-center cursor-pointer select-none"
                onClick={fetchCaptcha}
                title="Click to refresh captcha"
                dangerouslySetInnerHTML={{ __html: captchaChallenge.image }}
              />
              <Button
                type="button"
                variant="tertiary"
                isIconOnly
                size="sm"
                onPress={fetchCaptcha}
                isPending={captchaLoading}
                aria-label="Refresh captcha"
                className="size-9 shrink-0"
              >
                <RefreshCw className={`size-4 text-muted ${captchaLoading ? "animate-spin" : ""}`} />
              </Button>
            </div>
            <Input
              placeholder="Enter 4-letter code"
              type="text"
              isRequired
              value={captcha}
              onChange={(e) => setCaptcha(e.target.value.toUpperCase())}
              className="w-full uppercase font-mono tracking-widest text-center text-lg"
              maxLength={6}
              autoComplete="off"
            />
          </div>

          <Button
            fullWidth
            type="submit"
            isPending={loading}
            className="mt-2 font-medium"
          >
            {loading ? <Spinner color="current" size="sm" /> : t("common.login") || "Log in"}
          </Button>
        </Form>
      </div>
    </div>
  );
}
