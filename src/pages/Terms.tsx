import { motion } from "framer-motion";
import { Activity, ArrowLeft } from "lucide-react";
import { Link } from "react-router-dom";
import { usePageTitle } from "@/hooks/usePageTitle";
import { useLanguage } from "@/contexts/LanguageContext";

const content = {
  en: {
    title: "Terms of Service",
    updated: "Last updated: March 2026",
    s1h: "1. Acceptance of Terms",
    s1: "By accessing or using ApexPredict, you agree to these Terms of Service. If you do not agree with any part of these terms, you must not use the service.",
    s2h: "2. Description of Service",
    s2: "ApexPredict is a financial analysis platform that uses artificial intelligence to generate price forecasts for financial assets. The forecasts generated are for informational purposes only and do not constitute financial advice.",
    s3h: "3. Financial Disclaimer",
    s3a: "The forecasts and analyses provided by ApexPredict are based on algorithmic models and historical data.",
    s3b: "They do not constitute investment recommendations.",
    s3c: "Any investment decision is the sole responsibility of the user. ApexPredict is not liable for any financial losses resulting from the use of its forecasts.",
    s4h: "4. User Account",
    s4: "To access the service's features, you must create an account with accurate information. It is your responsibility to maintain the confidentiality of your credentials and to notify us immediately of any unauthorised access.",
    s5h: "5. Plans and Payments",
    s5: "ApexPredict offers free and paid plans. Payments are processed securely through Stripe. Subscriptions renew automatically at the end of each period unless cancelled beforehand. No refunds are issued for partial periods.",
    s6h: "6. Acceptable Use",
    s6: "You agree not to use the service for illegal purposes, not to attempt to access other users' data, not to overload the servers with automated requests, and not to redistribute data or forecasts without prior authorisation.",
    s7h: "7. Intellectual Property",
    s7: "All content, code and materials on ApexPredict are the property of its creators and are protected by copyright. Reproduction or distribution without written authorisation is prohibited.",
    s8h: "8. Changes to the Service",
    s8: "We reserve the right to modify or discontinue the service at any time, with or without notice. We may also update these terms — changes take effect upon publication.",
    s9h: "9. Contact",
    s9: "For questions about these terms, contact us through the support available on the platform.",
    back: "Back",
  },
  pt: {
    title: "Termos de Serviço",
    updated: "Última atualização: Março 2026",
    s1h: "1. Aceitação dos Termos",
    s1: "Ao aceder ou utilizar o ApexPredict, concordas com estes Termos de Serviço. Se não concordares com alguma parte destes termos, não deves utilizar o serviço.",
    s2h: "2. Descrição do Serviço",
    s2: "O ApexPredict é uma plataforma de análise financeira que utiliza inteligência artificial para gerar previsões de preços de ativos financeiros. As previsões geradas são meramente informativas e não constituem aconselhamento financeiro.",
    s3h: "3. Isenção de Responsabilidade Financeira",
    s3a: "As previsões e análises fornecidas pelo ApexPredict são baseadas em modelos algorítmicos e dados históricos.",
    s3b: "Não constituem recomendações de investimento.",
    s3c: "Qualquer decisão de investimento é da exclusiva responsabilidade do utilizador. O ApexPredict não se responsabiliza por perdas financeiras decorrentes da utilização das previsões.",
    s4h: "4. Conta de Utilizador",
    s4: "Para aceder às funcionalidades do serviço, deves criar uma conta com informações verdadeiras. É da tua responsabilidade manter a confidencialidade das tuas credenciais e notificar-nos imediatamente em caso de acesso não autorizado.",
    s5h: "5. Planos e Pagamentos",
    s5: "O ApexPredict oferece planos gratuitos e pagos. Os pagamentos são processados de forma segura através do Stripe. As subscrições renovam-se automaticamente no fim de cada período, salvo cancelamento prévio. Não são feitos reembolsos por períodos parciais.",
    s6h: "6. Uso Aceitável",
    s6: "Comprometes-te a não utilizar o serviço para fins ilegais, não tentar aceder a dados de outros utilizadores, não sobrecarregar os servidores com pedidos automatizados e não redistribuir os dados ou previsões sem autorização prévia.",
    s7h: "7. Propriedade Intelectual",
    s7: "Todo o conteúdo, código e materiais do ApexPredict são propriedade dos seus criadores e estão protegidos por direitos de autor. É proibida a reprodução ou distribuição sem autorização escrita.",
    s8h: "8. Alterações ao Serviço",
    s8: "Reservamo-nos o direito de modificar ou descontinuar o serviço a qualquer momento, com ou sem aviso prévio. Podemos também actualizar estes termos — as alterações entram em vigor após publicação.",
    s9h: "9. Contacto",
    s9: "Para questões sobre estes termos, contacta-nos através do suporte disponível na plataforma.",
    back: "Voltar",
  },
};

const Terms = () => {
  usePageTitle("Terms of Service");
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
            </section>
            <section>
              <h2 className="text-base font-semibold text-foreground mb-2">{c.s2h}</h2>
              <p>{c.s2}</p>
            </section>
            <section>
              <h2 className="text-base font-semibold text-foreground mb-2">{c.s3h}</h2>
              <p>{c.s3a} <strong className="text-foreground">{c.s3b}</strong> {c.s3c}</p>
            </section>
            <section>
              <h2 className="text-base font-semibold text-foreground mb-2">{c.s4h}</h2>
              <p>{c.s4}</p>
            </section>
            <section>
              <h2 className="text-base font-semibold text-foreground mb-2">{c.s5h}</h2>
              <p>{c.s5}</p>
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
            <section>
              <h2 className="text-base font-semibold text-foreground mb-2">{c.s9h}</h2>
              <p>{c.s9}</p>
            </section>
          </div>
        </motion.div>
      </div>
    </div>
  );
};

export default Terms;
