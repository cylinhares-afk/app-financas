import type { Usuario } from '../../types/domain'

interface SeletorPerfilProps {
  usuarios: Usuario[]
  erro: string | null
  onSelecionar: (id: string) => void
}

export function SeletorPerfil({ usuarios, erro, onSelecionar }: SeletorPerfilProps) {
  return (
    <div className="tela-login">
      <h1>Quem é você?</h1>
      <p className="tela-login__subtitulo">Só pra marcar quem lançou cada gasto</p>

      {erro && <p className="tela-login__erro">Erro ao buscar perfis: {erro}</p>}
      {!erro && usuarios.length === 0 && (
        <p className="tela-login__erro">
          Nenhum perfil encontrado na tabela "usuarios" — confira se o schema.sql foi rodado por
          completo (incluindo o insert de seed no final do arquivo).
        </p>
      )}

      <div className="seletor-perfil__lista">
        {usuarios.map((usuario) => (
          <button key={usuario.id} type="button" onClick={() => onSelecionar(usuario.id)}>
            {usuario.nome}
          </button>
        ))}
      </div>
    </div>
  )
}
