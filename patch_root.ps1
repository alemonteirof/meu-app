$path = "src\App.jsx"
$content = Get-Content -Raw -Path $path

# 1) importar o novo componente
$old1 = "import { createClient } from '@supabase/supabase-js';"
$new1 = "import { createClient } from '@supabase/supabase-js';`r`nimport ToolChecklistForm from './components/ToolChecklistForm';"
if ($content -notlike "*$old1*") { Write-Warning "PASSO 1: nao encontrei a linha do import do createClient. Adicione manualmente: $new1" }
else { $content = $content.Replace($old1, $new1) }

# 2) novo estado showToolChecklist dentro de Root()
$old2 = "const [activeClientId, setActiveClientId] = useState(null);"
$new2 = "const [activeClientId, setActiveClientId] = useState(null);`r`n  const [showToolChecklist, setShowToolChecklist] = useState(false);"
if ($content -notlike "*$old2*") { Write-Warning "PASSO 2: nao encontrei a linha do useState(activeClientId). Adicione manualmente." }
else { $content = $content.Replace($old2, $new2) }

# 3) trocar o retorno do ClientSelector por uma versao com o botao de checklist
$old3 = "  if (!activeClientId) {`r`n    return <ClientSelector clients={visibleClients} canManage={isOwner} onSelect={selectClient} onCreate={createClient} onUpdate={updateClient} onDelete={deleteClient} />;`r`n  }"
$new3 = @"
  const isMajStaff = isOwner || (memberships || []).some((m) => m.role === 'admin' || m.role === 'operador');

  if (!activeClientId) {
    if (showToolChecklist) {
      return (
        <div>
          <div className="p-4">
            <button onClick={() => setShowToolChecklist(false)} className="text-sm underline" style={{ color: 'var(--accent)' }}>
              ← Voltar
            </button>
          </div>
          <ToolChecklistForm clients={visibleClients} />
        </div>
      );
    }
    return (
      <div>
        {isMajStaff && (
          <div className="p-4 flex justify-end">
            <button onClick={() => setShowToolChecklist(true)} className="px-4 py-2 rounded-lg text-sm font-medium text-white" style={{ background: '#8B2F2F' }}>
              Checklist de Ferramentas
            </button>
          </div>
        )}
        <ClientSelector clients={visibleClients} canManage={isOwner} onSelect={selectClient} onCreate={createClient} onUpdate={updateClient} onDelete={deleteClient} />
      </div>
    );
  }
"@
if ($content -notlike "*$old3*") { Write-Warning "PASSO 3: nao encontrei o bloco 'if (!activeClientId) { return <ClientSelector...'. Precisa editar manualmente (veja instrucoes)." }
else { $content = $content.Replace($old3, $new3) }

Set-Content -Path $path -Value $content -NoNewline -Encoding utf8
Write-Host "Patch aplicado (confira os avisos amarelos acima, se houver)."
