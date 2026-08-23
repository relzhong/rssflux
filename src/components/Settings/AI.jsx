import { ItemWrapper } from "@/components/ui/settingItem.jsx";
import { Sparkles, ShieldCheck } from "lucide-react";
import { useTranslation } from "react-i18next";

export default function AI() {
  const { t } = useTranslation();

  return (
    <div className="flex flex-col gap-4">
      <ItemWrapper title={t("settings.ai.title") || "AI Summary"}>
        <div className="bg-default/60 dark:bg-default/30 p-4 flex flex-col gap-3 rounded-xl">
          <div className="flex items-center gap-2 text-accent">
            <Sparkles className="size-5" />
            <span className="font-semibold text-sm">Server-Managed AI TL;DR</span>
          </div>
          <p className="text-xs text-muted leading-relaxed">
            AI article summarization is handled securely by the Nextflux Fastify BFF. All upstream model keys, endpoints, and prompts are managed server-side.
          </p>
          <div className="flex items-center gap-2 text-xs text-green-500 font-medium pt-1">
            <ShieldCheck className="size-4" />
            <span>Credentials secured on server • Multi-device TL;DR sync enabled</span>
          </div>
        </div>
      </ItemWrapper>
    </div>
  );
}
