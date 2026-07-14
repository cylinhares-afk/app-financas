import { useEffect, useState } from 'react'
import { useSession } from './features/auth/useSession'
import { LoginScreen } from './features/auth/LoginScreen'
import { usePerfilAtivo } from './features/perfil/usePerfilAtivo'
import { SeletorPerfil } from './features/perfil/SeletorPerfil'
import { TelaCategorias } from './features/budget/TelaCategorias'
import { TelaLancamento } from './features/lancamento/TelaLancamento'
import { gerarOcorrenciasRecorrentesPendentes } from './features/lancamento/gerarOcorrenciasRecorrentes'
import { TelaHome } from './features/home/TelaHome'
import type { FiltroHome } from './features/home/TelaHome'
import { TelaTotais } from './features/totais/TelaTotais'
import { TelaMenu } from './features/menu/TelaMenu'
import { TelaEconomias } from './features/economias/TelaEconomias'
import { ModalFechamentoMes } from './features/economias/ModalFechamentoMes'
import { useFechamentoPendente } from './features/economias/useFechamentoPendente'
import { TelaCartoes } from './features/cartoes/TelaCartoes'
import { hojeISO } from './lib/dataISO'
import type { TipoMovimento } from './types/domain'
import './App.css'

type Aba = 'home' | 'categorias' | 'totais' | 'lancamento' | 'menu' | 'economias' | 'cartoes'
// De onde veio o pedido pra abrir Categorias já no modo de edição do
// previsto: do Menu (edição avulsa) ou do atalho "+ nova categoria" do
// Registro (edição + volta pro Registro com a categoria criada
// selecionada). null = navegação normal pela aba, abre em modo de
// visualização.
type OrigemEdicaoCategorias = 'menu' | 'lancamento' | null

const ABAS: { id: Aba; rotulo: string }[] = [
  { id: 'home', rotulo: 'Home' },
  { id: 'categorias', rotulo: 'Categorias' },
  { id: 'totais', rotulo: 'Totais' },
  { id: 'lancamento', rotulo: '+' },
  { id: 'menu', rotulo: 'Menu' },
]

function App() {
  const [abaAtiva, setAbaAtiva] = useState<Aba>('home')
  const { session, carregando: carregandoSessao } = useSession()
  const {
    usuarios,
    perfilAtivo,
    carregando: carregandoPerfil,
    erro: erroPerfil,
    selecionar,
    limpar: limparPerfil,
  } = usePerfilAtivo(Boolean(session))

  const [sincronizandoRecorrencias, setSincronizandoRecorrencias] = useState(true)

  const [origemEdicaoCategorias, setOrigemEdicaoCategorias] = useState<OrigemEdicaoCategorias>(null)
  const [categoriaParaSelecionar, setCategoriaParaSelecionar] = useState<string | null>(null)

  const [tipoMovimentoLancamento, setTipoMovimentoLancamento] = useState<TipoMovimento>('saida')
  const [dataLancamentoInicial, setDataLancamentoInicial] = useState(hojeISO())

  const temSessao = Boolean(session)
  useEffect(() => {
    if (!temSessao) return
    gerarOcorrenciasRecorrentesPendentes().finally(() => setSincronizandoRecorrencias(false))
  }, [temSessao])

  const [versaoHome, setVersaoHome] = useState(0)
  const fechamento = useFechamentoPendente(temSessao && Boolean(perfilAtivo) && !sincronizandoRecorrencias)

  async function handleConfirmarFechamento() {
    await fechamento.confirmar()
    setVersaoHome((versao) => versao + 1)
  }

  if (carregandoSessao) return null

  if (!session) return <LoginScreen />

  if (carregandoPerfil) return null

  if (!perfilAtivo)
    return <SeletorPerfil usuarios={usuarios} erro={erroPerfil} onSelecionar={selecionar} />

  if (sincronizandoRecorrencias) return null

  function abrirNovoLancamento() {
    setDataLancamentoInicial(hojeISO())
    setTipoMovimentoLancamento('saida')
    setAbaAtiva('lancamento')
  }

  // Navegação manual pela barra inferior sempre volta pro modo de
  // visualização normal — só entra em modo de edição via os atalhos
  // explícitos (Menu, ou "+ nova categoria" do Registro).
  function irParaAba(aba: Aba) {
    setOrigemEdicaoCategorias(null)
    setAbaAtiva(aba)
  }

  function handleDiaClicadoNaHome(dataISO: string, filtro: FiltroHome) {
    setDataLancamentoInicial(dataISO)
    // 'saidas'/'cartao' começam em Saída, 'entradas' em Entrada; 'todas' e
    // 'diarios' não dão pra saber qual dos dois, então também começam em
    // Saída — o alternador no topo do Registro deixa trocar ali mesmo.
    setTipoMovimentoLancamento(filtro === 'entradas' ? 'entrada' : 'saida')
    setAbaAtiva('lancamento')
  }

  // O Registro fica montado (só escondido) enquanto o usuário está em
  // Categorias via o atalho "+ nova categoria" — assim nada do que já foi
  // digitado se perde.
  const mostrarLancamentoEscondido = abaAtiva === 'categorias' && origemEdicaoCategorias === 'lancamento'

  return (
    <>
      <main className="conteudo">
        {abaAtiva === 'home' && <TelaHome key={versaoHome} onDiaClicado={handleDiaClicadoNaHome} />}
        {abaAtiva === 'categorias' && (
          <TelaCategorias
            iniciarEmEdicao={origemEdicaoCategorias !== null}
            aoCriarCategoria={
              origemEdicaoCategorias === 'lancamento'
                ? (id) => {
                    setCategoriaParaSelecionar(id)
                    setOrigemEdicaoCategorias(null)
                    setAbaAtiva('lancamento')
                  }
                : undefined
            }
            onVoltar={
              origemEdicaoCategorias === 'lancamento'
                ? () => {
                    setOrigemEdicaoCategorias(null)
                    setAbaAtiva('lancamento')
                  }
                : undefined
            }
          />
        )}
        {abaAtiva === 'totais' && <TelaTotais />}

        {(abaAtiva === 'lancamento' || mostrarLancamentoEscondido) && (
          <div hidden={abaAtiva !== 'lancamento'}>
            <TelaLancamento
              usuarioId={perfilAtivo.id}
              tipoMovimentoInicial={tipoMovimentoLancamento}
              dataInicial={dataLancamentoInicial}
              categoriaParaSelecionar={categoriaParaSelecionar}
              onGastoRegistrado={() => irParaAba('categorias')}
              onEditarPrevisao={() => {
                setOrigemEdicaoCategorias('lancamento')
                setCategoriaParaSelecionar(null)
                setAbaAtiva('categorias')
              }}
            />
          </div>
        )}

        {abaAtiva === 'menu' && (
          <TelaMenu
            perfilAtivo={perfilAtivo}
            onTrocarPerfil={limparPerfil}
            onEditarPrevisao={() => {
              setOrigemEdicaoCategorias('menu')
              setAbaAtiva('categorias')
            }}
            onAbrirEconomias={() => setAbaAtiva('economias')}
            onAbrirCartoes={() => setAbaAtiva('cartoes')}
          />
        )}

        {abaAtiva === 'economias' && <TelaEconomias />}

        {abaAtiva === 'cartoes' && <TelaCartoes onVoltar={() => setAbaAtiva('menu')} />}
      </main>

      {fechamento.pendente && (
        <ModalFechamentoMes
          pendente={fechamento.pendente}
          onConfirmar={handleConfirmarFechamento}
          onRecusar={fechamento.recusar}
        />
      )}

      <nav className="nav-inferior">
        {ABAS.map((aba) => (
          <button
            key={aba.id}
            type="button"
            className={`nav-inferior__item ${abaAtiva === aba.id ? 'nav-inferior__item--ativo' : ''} ${aba.id === 'lancamento' ? 'nav-inferior__item--central' : ''}`}
            onClick={() => (aba.id === 'lancamento' ? abrirNovoLancamento() : irParaAba(aba.id))}
          >
            {aba.rotulo}
          </button>
        ))}
      </nav>
    </>
  )
}

export default App
