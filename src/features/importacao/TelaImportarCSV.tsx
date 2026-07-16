import { useEffect, useState } from 'react'
import type { ChangeEvent } from 'react'
import { fetchCartoes, fetchCategorias, fetchGastosParaVerificarDuplicatas } from '../../lib/queries'
import { MODELO_CSV, parseCSVImportacao, separarNovasEDuplicadas } from './csvImportacao'
import type { ErroLinhaCSV, LinhaCSVValidada } from './csvImportacao'
import { executarImportacaoCSV } from './executarImportacaoCSV'
import type { ResultadoImportacaoCSV } from './executarImportacaoCSV'
import type { Cartao, Categoria } from '../../types/domain'

interface TelaImportarCSVProps {
  usuarioId: string
  onVoltar: () => void
}

interface PreviaImportacao {
  linhasNovas: LinhaCSVValidada[]
  linhasDuplicadas: LinhaCSVValidada[]
  erros: ErroLinhaCSV[]
  categoriasNovas: string[]
}

function baixarModeloCSV() {
  const blob = new Blob([MODELO_CSV], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = 'modelo-importacao.csv'
  link.click()
  URL.revokeObjectURL(url)
}

export function TelaImportarCSV({ usuarioId, onVoltar }: TelaImportarCSVProps) {
  const [categorias, setCategorias] = useState<Categoria[]>([])
  const [cartoes, setCartoes] = useState<Cartao[]>([])
  const [carregando, setCarregando] = useState(true)
  const [erroCarregamento, setErroCarregamento] = useState<string | null>(null)

  const [nomeArquivo, setNomeArquivo] = useState<string | null>(null)
  const [analisando, setAnalisando] = useState(false)
  const [previa, setPrevia] = useState<PreviaImportacao | null>(null)
  const [importando, setImportando] = useState(false)
  const [resultado, setResultado] = useState<ResultadoImportacaoCSV | null>(null)

  useEffect(() => {
    Promise.all([fetchCategorias(), fetchCartoes()]).then(([categoriasResp, cartoesResp]) => {
      setCategorias(categoriasResp.dados)
      setCartoes(cartoesResp.dados)
      setErroCarregamento(categoriasResp.erro ?? cartoesResp.erro)
      setCarregando(false)
    })
  }, [])

  function handleArquivoSelecionado(evento: ChangeEvent<HTMLInputElement>) {
    const arquivo = evento.target.files?.[0]
    evento.target.value = '' // permite selecionar o mesmo arquivo de novo depois (ex: pra reimportar após corrigir)
    if (!arquivo) return

    setResultado(null)
    setPrevia(null)
    setNomeArquivo(arquivo.name)
    setAnalisando(true)

    const leitor = new FileReader()
    leitor.onload = async () => {
      const conteudo = String(leitor.result ?? '')
      const { linhasValidas, erros, categoriasNovas } = parseCSVImportacao(conteudo, categorias, cartoes)

      // Duplicata só pode ser detectada olhando o que já existe no banco —
      // busca na hora, pra permitir reimportar o mesmo arquivo mais de uma
      // vez sem duplicar o que já entrou numa tentativa anterior.
      const { dados: gastosExistentes, erro: erroBusca } = await fetchGastosParaVerificarDuplicatas()
      if (erroBusca) {
        setErroCarregamento(erroBusca)
        setAnalisando(false)
        return
      }

      const { linhasNovas, linhasDuplicadas } = separarNovasEDuplicadas(linhasValidas, gastosExistentes)
      setPrevia({ linhasNovas, linhasDuplicadas, erros, categoriasNovas })
      setAnalisando(false)
    }
    leitor.readAsText(arquivo, 'utf-8')
  }

  async function handleConfirmar() {
    if (!previa || previa.linhasNovas.length === 0) return

    setImportando(true)
    const cartoesPorId = new Map(cartoes.map((cartao) => [cartao.id, cartao]))
    const resultadoImportacao = await executarImportacaoCSV(previa.linhasNovas, cartoesPorId, usuarioId)
    setImportando(false)
    setResultado(resultadoImportacao)
    setPrevia(null)
    setNomeArquivo(null)

    // Categorias novas criadas nessa importação passam a contar como
    // existentes numa próxima (evita recriar/duplicar se o usuário importar
    // outro arquivo em seguida referenciando a mesma categoria).
    const { dados } = await fetchCategorias()
    setCategorias(dados)
  }

  if (carregando) return <p className="tela-categorias__aviso">Carregando…</p>

  return (
    <div className="tela-cartoes">
      <button type="button" className="tela-previsao__voltar" onClick={onVoltar}>
        ← Voltar
      </button>

      <h2>Importar CSV</h2>
      <p className="tela-login__subtitulo">
        Importação em massa de saídas (entradas continuam sendo lançadas manualmente). Baixe o modelo, preencha uma
        linha por lançamento e envie o arquivo — você confirma antes de qualquer coisa ser salva de verdade. Linhas
        idênticas a lançamentos que já existem (mesma data, valor, categoria, meio de pagamento e descrição) são
        detectadas e puladas automaticamente, então é seguro reimportar o mesmo arquivo mais de uma vez.
      </p>

      {erroCarregamento && <p className="tela-login__erro">{erroCarregamento}</p>}

      <div className="tela-cartoes__form-acoes">
        <button type="button" onClick={baixarModeloCSV}>
          Baixar modelo de CSV
        </button>
      </div>

      <label className="tela-lancamento__campo">
        <span>Arquivo CSV</span>
        <input type="file" accept=".csv,text/csv" onChange={handleArquivoSelecionado} />
      </label>

      {nomeArquivo && analisando && <p className="tela-categorias__aviso">Analisando {nomeArquivo}…</p>}

      {nomeArquivo && previa && (
        <div className="tela-cartoes__form">
          <strong>{nomeArquivo}</strong>

          <p>
            {previa.linhasNovas.length === 0
              ? 'Nenhuma linha nova pra importar.'
              : previa.linhasNovas.length === 1
                ? '1 linha nova será importada.'
                : `${previa.linhasNovas.length} linhas novas serão importadas.`}
          </p>

          <p>
            {previa.linhasDuplicadas.length === 0
              ? 'Nenhuma duplicata encontrada.'
              : previa.linhasDuplicadas.length === 1
                ? '1 linha é duplicata de um lançamento que já existe — será pulada.'
                : `${previa.linhasDuplicadas.length} linhas são duplicatas de lançamentos que já existem — serão puladas.`}
          </p>

          {previa.categoriasNovas.length > 0 && (
            <p>
              {previa.categoriasNovas.length === 1
                ? '1 categoria nova será criada: '
                : `${previa.categoriasNovas.length} categorias novas serão criadas: `}
              {previa.categoriasNovas.join(', ')}
            </p>
          )}

          {previa.erros.length > 0 && (
            <div>
              <p>
                {previa.erros.length === 1
                  ? '1 linha com erro, não será importada:'
                  : `${previa.erros.length} linhas com erro, não serão importadas:`}
              </p>
              <ul>
                {previa.erros.map((erro) => (
                  <li key={erro.linha} className="tela-login__erro">
                    linha {erro.linha}: {erro.mensagem}
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div className="tela-cartoes__form-acoes">
            <button type="button" disabled={previa.linhasNovas.length === 0 || importando} onClick={handleConfirmar}>
              {importando
                ? '…'
                : `Confirmar importação (${previa.linhasNovas.length} ${previa.linhasNovas.length === 1 ? 'linha' : 'linhas'})`}
            </button>
          </div>
        </div>
      )}

      {resultado && (
        <div className="tela-cartoes__form">
          <p>
            {resultado.sucesso === 0
              ? 'Nenhum lançamento importado.'
              : resultado.sucesso === 1
                ? '1 lançamento importado com sucesso.'
                : `${resultado.sucesso} lançamentos importados com sucesso.`}
          </p>

          {resultado.falhas.length > 0 && (
            <div>
              <p>{resultado.falhas.length === 1 ? '1 linha falhou ao importar:' : `${resultado.falhas.length} linhas falharam ao importar:`}</p>
              <ul>
                {resultado.falhas.map((falha) => (
                  <li key={falha.linha} className="tela-login__erro">
                    linha {falha.linha}: {falha.mensagem}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
