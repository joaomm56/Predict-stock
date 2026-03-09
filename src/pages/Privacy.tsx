import { motion } from "framer-motion";
import { Activity, ArrowLeft } from "lucide-react";
import { Link } from "react-router-dom";
import { usePageTitle } from "@/hooks/usePageTitle";
import { useLanguage } from "@/contexts/LanguageContext";

const content = {
  en: {
    title: "Privacy Policy",
    updated: "Last updated: March 2026",
    back: "Back",
    s1h: "1. Data We Collect",
    s1: "We collect the following data when you use ApexPredict:",
    s1i: ["Email address and name (when creating an account)", "Usage data: tickers searched, forecasts generated", "Payment data processed by Stripe (we do not store card details)", "Technical data: IP address, browser type, operating system"],
    s2h: "2. How We Use Your Data",
    s2: "The collected data is used to:",
    s2i: ["Provide and improve the service", "Manage your account and subscription", "Send essential service communications", "Ensure security and prevent fraud"],
    s3h: "3. Data Sharing",
    s3: "We do not sell your personal data. We share data only with:",
    s3i: [["Supabase", "database and authentication"], ["Stripe", "payment processing"], ["Render", "server hosting"]],
    s3b: "All partners follow their own GDPR-compliant privacy policies.",
    s4h: "4. Cookies and Local Storage",
    s4: "We use browser local storage to save your authentication session and preferences (such as language). We do not use third-party tracking cookies.",
    s5h: "5. Your Rights (GDPR)",
    s5: "You have the right to:",
    s5i: ["Access your personal data", "Correct inaccurate data", "Request deletion of your account and data", "Export your data", "Object to data processing"],
    s5b: "To exercise any of these rights, contact us through the platform support.",
    s6h: "6. Data Security",
    s6: "We implement appropriate security measures, including encryption in transit (HTTPS), secure authentication via Supabase, and role-based access control (RLS). No transmission method is 100% secure, but we make every effort to protect your data.",
    s7h: "7. Data Retention",
    s7: "We retain your data while your account is active. After account deletion, data is removed within 30 days, except where required by law.",
    s8h: "8. Contact",
    s8: "For privacy questions or to exercise your rights, contact us through the support available on the platform.",
  },
  pt: {
    title: "Política de Privacidade",
    updated: "Última atualização: Março 2026",
    back: "Voltar",
    s1h: "1. Dados que Recolhemos",
    s1: "Recolhemos os seguintes dados quando utilizas o ApexPredict:",
    s1i: ["Endereço de e-mail e nome (ao criar conta)", "Dados de utilização: tickers pesquisados, previsões geradas", "Dados de pagamento processados pelo Stripe (não armazenamos dados de cartão)", "Dados técnicos: endereço IP, tipo de browser, sistema operativo"],
    s2h: "2. Como Utilizamos os Dados",
    s2: "Os dados recolhidos são utilizados para:",
    s2i: ["Fornecer e melhorar o serviço", "Gerir a tua conta e subscrição", "Enviar comunicações essenciais sobre o serviço", "Garantir a segurança e prevenir fraudes"],
    s3h: "3. Partilha de Dados",
    s3: "Não vendemos os teus dados pessoais. Partilhamos dados apenas com:",
    s3i: [["Supabase", "base de dados e autenticação"], ["Stripe", "processamento de pagamentos"], ["Render", "alojamento do servidor"]],
    s3b: "Todos os parceiros seguem as suas próprias políticas de privacidade conformes com o RGPD.",
    s4h: "4. Cookies e Armazenamento Local",
    s4: "Utilizamos o armazenamento local do browser para guardar a tua sessão de autenticação e preferências (como o idioma). Não utilizamos cookies de rastreamento de terceiros.",
    s5h: "5. Os Teus Direitos (RGPD)",
    s5: "Tens direito a:",
    s5i: ["Aceder aos teus dados pessoais", "Corrigir dados incorretos", "Solicitar a eliminação da tua conta e dados", "Exportar os teus dados", "Opor-te ao tratamento de dados"],
    s5b: "Para exerceres qualquer um destes direitos, contacta-nos através do suporte da plataforma.",
    s6h: "6. Segurança dos Dados",
    s6: "Implementamos medidas de segurança adequadas, incluindo encriptação em trânsito (HTTPS), autenticação segura via Supabase e controlo de acesso baseado em funções (RLS). Nenhum método de transmissão é 100% seguro, mas fazemos todos os esforços para proteger os teus dados.",
    s7h: "7. Retenção de Dados",
    s7: "Guardamos os teus dados enquanto a tua conta estiver ativa. Após eliminação da conta, os dados são removidos no prazo de 30 dias, exceto onde exigido por lei.",
    s8h: "8. Contacto",
    s8: "Para questões sobre privacidade ou para exercer os teus direitos, contacta-nos através do suporte disponível na plataforma.",
  },
};

const Privacy = () => {
  usePageTitle("Privacy Policy");
  const { language } = useLanguage();
  const c = content[language] ?? content.en;

  return (
    <div className="min-h-screen bg-background gradient-mesh px-4 py-12">
      <div className="max-w-3xl mx-auto">
        <div className="flex items-center gap-2 mb-8">
          <Link to="/register" className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-primary transition-colors">
            <ArrowLeft className="h-4 w-4" />
            {c.back}
          </Link>
        </div>

        <div className="flex items-center gap-2 mb-8">
          <Activity className="h-6 w-6 text-primary" />
          <span className="text-xl font-bold tracking-tight text-foreground">
            Apex<span className="text-primary">Predict</span>
          </span>
        </div>

        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="glass rounded-2xl p-8 box-glow"
        >
          <h1 className="text-2xl font-bold text-foreground mb-2">{c.title}</h1>
          <p className="text-xs text-muted-foreground mb-8">{c.updated}</p>

          <div className="space-y-6 text-sm text-muted-foreground leading-relaxed">
            <section>
              <h2 className="text-base font-semibold text-foreground mb-2">{c.s1h}</h2>
              <p>{c.s1}</p>
              <ul className="list-disc list-inside mt-2 space-y-1 pl-2">
                {c.s1i.map((item, i) => <li key={i}>{item}</li>)}
              </ul>
            </section>
            <section>
              <h2 className="text-base font-semibold text-foreground mb-2">{c.s2h}</h2>
              <p>{c.s2}</p>
              <ul className="list-disc list-inside mt-2 space-y-1 pl-2">
                {c.s2i.map((item, i) => <li key={i}>{item}</li>)}
              </ul>
            </section>
            <section>
              <h2 className="text-base font-semibold text-foreground mb-2">{c.s3h}</h2>
              <p>{c.s3}</p>
              <ul className="list-disc list-inside mt-2 space-y-1 pl-2">
                {c.s3i.map(([name, desc], i) => (
                  <li key={i}><strong className="text-foreground">{name}</strong> — {desc}</li>
                ))}
              </ul>
              <p className="mt-2">{c.s3b}</p>
            </section>
            <section>
              <h2 className="text-base font-semibold text-foreground mb-2">{c.s4h}</h2>
              <p>{c.s4}</p>
            </section>
            <section>
              <h2 className="text-base font-semibold text-foreground mb-2">{c.s5h}</h2>
              <p>{c.s5}</p>
              <ul className="list-disc list-inside mt-2 space-y-1 pl-2">
                {c.s5i.map((item, i) => <li key={i}>{item}</li>)}
              </ul>
              <p className="mt-2">{c.s5b}</p>
            </section>
            <section>
              <h2 className="text-base font-semibold text-foreground mb-2">{c.s6h}</h2>
              <p>{c.s6}</p>
            </section>
            <section>
              <h2 className="text-base font-semibold text-foreground mb-2">{c.s7h}</h2>
              <p>{c.s7}</p>
            </section>
            <section>
              <h2 className="text-base font-semibold text-foreground mb-2">{c.s8h}</h2>
              <p>{c.s8}</p>
            </section>
          </div>
        </motion.div>
      </div>
    </div>
  );
};

export default Privacy;
