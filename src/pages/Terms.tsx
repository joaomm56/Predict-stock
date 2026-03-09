import { motion } from "framer-motion";
import { Activity, ArrowLeft } from "lucide-react";
import { Link } from "react-router-dom";
import { usePageTitle } from "@/hooks/usePageTitle";

const Terms = () => {
  usePageTitle("Termos de Serviço");

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
          <h1 className="text-2xl font-bold text-foreground mb-2">Termos de Serviço</h1>
          <p className="text-xs text-muted-foreground mb-8">Última atualização: Março 2026</p>

          <div className="space-y-6 text-sm text-muted-foreground leading-relaxed">
            <section>
              <h2 className="text-base font-semibold text-foreground mb-2">1. Aceitação dos Termos</h2>
              <p>
                Ao aceder ou utilizar o ApexPredict, concordas com estes Termos de Serviço. Se não concordares
                com alguma parte destes termos, não deves utilizar o serviço.
              </p>
            </section>

            <section>
              <h2 className="text-base font-semibold text-foreground mb-2">2. Descrição do Serviço</h2>
              <p>
                O ApexPredict é uma plataforma de análise financeira que utiliza inteligência artificial para
                gerar previsões de preços de ativos financeiros. As previsões geradas são meramente informativas
                e não constituem aconselhamento financeiro.
              </p>
            </section>

            <section>
              <h2 className="text-base font-semibold text-foreground mb-2">3. Isenção de Responsabilidade Financeira</h2>
              <p>
                As previsões e análises fornecidas pelo ApexPredict são baseadas em modelos algorítmicos e dados
                históricos. <strong className="text-foreground">Não constituem recomendações de investimento.</strong>{" "}
                Qualquer decisão de investimento é da exclusiva responsabilidade do utilizador. O ApexPredict não
                se responsabiliza por perdas financeiras decorrentes da utilização das previsões.
              </p>
            </section>

            <section>
              <h2 className="text-base font-semibold text-foreground mb-2">4. Conta de Utilizador</h2>
              <p>
                Para aceder às funcionalidades do serviço, deves criar uma conta com informações verdadeiras.
                É da tua responsabilidade manter a confidencialidade das tuas credenciais e notificar-nos
                imediatamente em caso de acesso não autorizado.
              </p>
            </section>

            <section>
              <h2 className="text-base font-semibold text-foreground mb-2">5. Planos e Pagamentos</h2>
              <p>
                O ApexPredict oferece planos gratuitos e pagos. Os pagamentos são processados de forma segura
                através do Stripe. As subscrições renovam-se automaticamente no fim de cada período, salvo
                cancelamento prévio. Não são feitos reembolsos por períodos parciais.
              </p>
            </section>

            <section>
              <h2 className="text-base font-semibold text-foreground mb-2">6. Uso Aceitável</h2>
              <p>
                Comprometes-te a não utilizar o serviço para fins ilegais, não tentar aceder a dados de outros
                utilizadores, não sobrecarregar os servidores com pedidos automatizados e não redistribuir
                os dados ou previsões sem autorização prévia.
              </p>
            </section>

            <section>
              <h2 className="text-base font-semibold text-foreground mb-2">7. Propriedade Intelectual</h2>
              <p>
                Todo o conteúdo, código e materiais do ApexPredict são propriedade dos seus criadores e estão
                protegidos por direitos de autor. É proibida a reprodução ou distribuição sem autorização escrita.
              </p>
            </section>

            <section>
              <h2 className="text-base font-semibold text-foreground mb-2">8. Alterações ao Serviço</h2>
              <p>
                Reservamo-nos o direito de modificar ou descontinuar o serviço a qualquer momento, com ou sem
                aviso prévio. Podemos também actualizar estes termos — as alterações entram em vigor após publicação.
              </p>
            </section>

            <section>
              <h2 className="text-base font-semibold text-foreground mb-2">9. Contacto</h2>
              <p>
                Para questões sobre estes termos, contacta-nos através do suporte disponível na plataforma.
              </p>
            </section>
          </div>
        </motion.div>
      </div>
    </div>
  );
};

export default Terms;
