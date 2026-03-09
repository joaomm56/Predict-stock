import { motion } from "framer-motion";
import { Activity, ArrowLeft } from "lucide-react";
import { Link } from "react-router-dom";
import { usePageTitle } from "@/hooks/usePageTitle";

const Privacy = () => {
  usePageTitle("Política de Privacidade");

  return (
    <div className="min-h-screen bg-background gradient-mesh px-4 py-12">
      <div className="max-w-3xl mx-auto">
        <div className="flex items-center gap-2 mb-8">
          <Link
            to="/register"
            className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-primary transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
            Voltar
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
          <h1 className="text-2xl font-bold text-foreground mb-2">Política de Privacidade</h1>
          <p className="text-xs text-muted-foreground mb-8">Última atualização: Março 2026</p>

          <div className="space-y-6 text-sm text-muted-foreground leading-relaxed">
            <section>
              <h2 className="text-base font-semibold text-foreground mb-2">1. Dados que Recolhemos</h2>
              <p>Recolhemos os seguintes dados quando utilizas o ApexPredict:</p>
              <ul className="list-disc list-inside mt-2 space-y-1 pl-2">
                <li>Endereço de e-mail e nome (ao criar conta)</li>
                <li>Dados de utilização: tickers pesquisados, previsões geradas</li>
                <li>Dados de pagamento processados pelo Stripe (não armazenamos dados de cartão)</li>
                <li>Dados técnicos: endereço IP, tipo de browser, sistema operativo</li>
              </ul>
            </section>

            <section>
              <h2 className="text-base font-semibold text-foreground mb-2">2. Como Utilizamos os Dados</h2>
              <p>Os dados recolhidos são utilizados para:</p>
              <ul className="list-disc list-inside mt-2 space-y-1 pl-2">
                <li>Fornecer e melhorar o serviço</li>
                <li>Gerir a tua conta e subscrição</li>
                <li>Enviar comunicações essenciais sobre o serviço</li>
                <li>Garantir a segurança e prevenir fraudes</li>
              </ul>
            </section>

            <section>
              <h2 className="text-base font-semibold text-foreground mb-2">3. Partilha de Dados</h2>
              <p>
                Não vendemos os teus dados pessoais. Partilhamos dados apenas com:
              </p>
              <ul className="list-disc list-inside mt-2 space-y-1 pl-2">
                <li><strong className="text-foreground">Supabase</strong> — base de dados e autenticação</li>
                <li><strong className="text-foreground">Stripe</strong> — processamento de pagamentos</li>
                <li><strong className="text-foreground">Render</strong> — alojamento do servidor</li>
              </ul>
              <p className="mt-2">Todos os parceiros seguem as suas próprias políticas de privacidade conformes com o RGPD.</p>
            </section>

            <section>
              <h2 className="text-base font-semibold text-foreground mb-2">4. Cookies e Armazenamento Local</h2>
              <p>
                Utilizamos o armazenamento local do browser para guardar a tua sessão de autenticação e
                preferências (como o idioma). Não utilizamos cookies de rastreamento de terceiros.
              </p>
            </section>

            <section>
              <h2 className="text-base font-semibold text-foreground mb-2">5. Os Teus Direitos (RGPD)</h2>
              <p>Tens direito a:</p>
              <ul className="list-disc list-inside mt-2 space-y-1 pl-2">
                <li>Aceder aos teus dados pessoais</li>
                <li>Corrigir dados incorretos</li>
                <li>Solicitar a eliminação da tua conta e dados</li>
                <li>Exportar os teus dados</li>
                <li>Opor-te ao tratamento de dados</li>
              </ul>
              <p className="mt-2">Para exerceres qualquer um destes direitos, contacta-nos através do suporte da plataforma.</p>
            </section>

            <section>
              <h2 className="text-base font-semibold text-foreground mb-2">6. Segurança dos Dados</h2>
              <p>
                Implementamos medidas de segurança adequadas, incluindo encriptação em trânsito (HTTPS),
                autenticação segura via Supabase e controlo de acesso baseado em funções (RLS). Nenhum
                método de transmissão é 100% seguro, mas fazemos todos os esforços para proteger os teus dados.
              </p>
            </section>

            <section>
              <h2 className="text-base font-semibold text-foreground mb-2">7. Retenção de Dados</h2>
              <p>
                Guardamos os teus dados enquanto a tua conta estiver ativa. Após eliminação da conta,
                os dados são removidos no prazo de 30 dias, exceto onde exigido por lei.
              </p>
            </section>

            <section>
              <h2 className="text-base font-semibold text-foreground mb-2">8. Contacto</h2>
              <p>
                Para questões sobre privacidade ou para exercer os teus direitos, contacta-nos através
                do suporte disponível na plataforma.
              </p>
            </section>
          </div>
        </motion.div>
      </div>
    </div>
  );
};

export default Privacy;
