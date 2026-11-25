# sincronizar-banco.ps1
# Mantem o banco de frases e os templates intermediarios iguais em 3 lugares:
# Pendrive, Google Drive (pasta do Drive para computador) e GitHub (repositorio privado so do banco).
# Regra: vale o arquivo MAIS NOVO (data de modificacao). Antes de substituir qualquer arquivo, guarda um backup.
# Nunca edita o texto: so copia o arquivo inteiro. Nao mexe em rascunhos, backups do app, dados.json nem configuracoes.json.
# Uso: duplo clique em sincronizar-banco.bat  (ou -Simular para so conferir).
param(
    [switch]$Simular,
    [string]$Config = ''
)

$ErrorActionPreference = 'Stop'
try { [Console]::OutputEncoding = [System.Text.Encoding]::UTF8 } catch {}
if (-not $Config) { $Config = Join-Path $PSScriptRoot 'sincronizar-banco-config.ini' }

# Arquivos sincronizados: nome no computador -> nome no repositorio (sem acento, so o nome do arquivo)
$Arquivos = @(
    @{ Nome = 'banco-de-frases.txt';            NomeRepo = 'banco-de-frases.txt' },
    @{ Nome = 'templates intermediários.txt';   NomeRepo = 'templates-intermediarios.txt' }
)

$resumo = New-Object System.Collections.ArrayList
$avisos = New-Object System.Collections.ArrayList
function Dizer($t) { Write-Host $t }
function Aviso($t) { [void]$avisos.Add($t); Write-Host ("  ! " + $t) -ForegroundColor Yellow }

# ---------- configuracao ----------
function Ler-Config($caminho) {
    $c = @{}
    if (-not (Test-Path -LiteralPath $caminho)) { throw "Nao achei o arquivo de configuracao: $caminho" }
    foreach ($linha in (Get-Content -LiteralPath $caminho -Encoding UTF8)) {
        $l = $linha.Trim()
        if ($l -eq '' -or $l.StartsWith('#')) { continue }
        $i = $l.IndexOf('=')
        if ($i -lt 1) { continue }
        $k = $l.Substring(0, $i).Trim()
        $v = $l.Substring($i + 1).Trim()
        if (-not $c.ContainsKey($k)) { $c[$k] = New-Object System.Collections.ArrayList }
        [void]$c[$k].Add([Environment]::ExpandEnvironmentVariables($v))
    }
    return $c
}
function Cfg1($c, $k, $padrao) { if ($c.ContainsKey($k)) { return $c[$k][0] } else { return $padrao } }

function Hash-Arq($p) { return (Get-FileHash -LiteralPath $p -Algorithm SHA256).Hash }
function Hora($utc) { return $utc.ToLocalTime().ToString('dd/MM/yyyy HH:mm:ss') }

function Git-Rodar($pasta, [string[]]$argumentos) {
    $ea = $ErrorActionPreference
    $ErrorActionPreference = 'Continue'
    try {
        $saida = & git -C $pasta @argumentos 2>&1 | ForEach-Object { "$_" }
        $codigo = $LASTEXITCODE
    } finally { $ErrorActionPreference = $ea }
    return @{ Codigo = $codigo; Saida = (($saida | Out-String).Trim()) }
}

# ---------- inicio ----------
Dizer ''
Dizer '=============================================='
if ($Simular) { Dizer ' SINCRONIZAR BANCO  (so conferindo: nada sera alterado)' }
else          { Dizer ' SINCRONIZAR BANCO' }
Dizer '=============================================='

$cfg = Ler-Config $Config
$guardar = [int](Cfg1 $cfg 'GuardarBackups' '20')
$pctMin  = [int](Cfg1 $cfg 'PorcentagemMinima' '50')

# ---------- achar os lugares ----------
$lugares = New-Object System.Collections.ArrayList

# Pendrive
$pend = $null
$letras = @(Get-PSDrive -PSProvider FileSystem | Where-Object { $_.Root -match '^[A-Za-z]:\\$' } | ForEach-Object { $_.Root.Substring(0, 1) })
foreach ($modelo in @($cfg['Pendrive'])) {
    if (-not $modelo) { continue }
    if ($modelo -like '*{LETRA}*') {
        foreach ($L in $letras) {
            $p = $modelo.Replace('{LETRA}', $L)
            if (Test-Path -LiteralPath $p -PathType Container) { $pend = $p; break }
        }
    } elseif (Test-Path -LiteralPath $modelo -PathType Container) { $pend = $modelo }
    if ($pend) { break }
}
if ($pend) { [void]$lugares.Add(@{ Id = 'Pendrive'; Rotulo = "Pendrive ($($pend.Substring(0,2)))"; Pasta = $pend; Ativo = $true; Tipo = 'pasta'; Prioridade = 0 }) }
else       { [void]$lugares.Add(@{ Id = 'Pendrive'; Rotulo = 'Pendrive'; Pasta = $null; Ativo = $false; Motivo = 'pendrive nao encontrado (esta conectado? a pasta Trampo\Ultra-formulario (Zenacto) existe nele?)'; Tipo = 'pasta'; Prioridade = 0 }) }

# Google Drive
$drv = $null
foreach ($p in @($cfg['Drive'])) { if ($p -and (Test-Path -LiteralPath $p -PathType Container)) { $drv = $p; break } }
if ($drv) { [void]$lugares.Add(@{ Id = 'Drive'; Rotulo = 'Google Drive'; Pasta = $drv; Ativo = $true; Tipo = 'pasta'; Prioridade = 1 }) }
else      { [void]$lugares.Add(@{ Id = 'Drive'; Rotulo = 'Google Drive'; Pasta = $null; Ativo = $false; Motivo = 'pasta do Google Drive para computador nao encontrada neste computador'; Tipo = 'pasta'; Prioridade = 1 }) }

# GitHub (pasta local = copia do repositorio)
$gh = @{ Id = 'GitHub'; Rotulo = 'GitHub (privado)'; Pasta = (Cfg1 $cfg 'GitHubLocal' ''); Ativo = $false; Tipo = 'git'; Prioridade = 2; Repo = (Cfg1 $cfg 'GitHubRepo' '') }
[void]$lugares.Add($gh)
if (-not (Get-Command git -ErrorAction SilentlyContinue)) {
    $gh.Motivo = 'Git nao esta instalado neste computador (instale o "Git for Windows" e entre na conta GitHub)'
} elseif (-not $gh.Pasta -or -not $gh.Repo) {
    $gh.Motivo = 'GitHubRepo/GitHubLocal nao configurados'
} else {
    $pastaGit = $gh.Pasta
    $ok = $true
    if (-not (Test-Path -LiteralPath $pastaGit)) {
        Dizer '  Baixando o repositorio do GitHub pela primeira vez...'
        $r = Git-Rodar (Split-Path $pastaGit -Parent) @('clone', $gh.Repo, $pastaGit)
        if ($r.Codigo -ne 0) { $ok = $false; $gh.Motivo = 'nao consegui baixar o repositorio (sem internet ou sem login no GitHub?)' }
    }
    if ($ok) {
        if (-not (Test-Path -LiteralPath (Join-Path $pastaGit '.git'))) {
            $ok = $false; $gh.Motivo = "a pasta $pastaGit existe mas nao e o repositorio"
        }
    }
    if ($ok) {
        [void](Git-Rodar $pastaGit @('config', 'core.autocrlf', 'false'))
        [void](Git-Rodar $pastaGit @('config', 'core.quotepath', 'false'))
        $ident = Git-Rodar $pastaGit @('config', 'user.name')
        if ($ident.Codigo -ne 0 -or -not $ident.Saida) {
            [void](Git-Rodar $pastaGit @('config', 'user.name', 'sincronizar-banco'))
            [void](Git-Rodar $pastaGit @('config', 'user.email', 'sincronizar-banco@users.noreply.github.com'))
        }
        $r = Git-Rodar $pastaGit @('pull', '--ff-only')
        if ($r.Codigo -ne 0) { $ok = $false; $gh.Motivo = 'nao consegui atualizar pelo GitHub (sem internet, sem login ou conflito)' }
    }
    if ($ok) { $gh.Ativo = $true }
}

Dizer ''
Dizer 'Lugares:'
foreach ($l in $lugares) {
    if ($l.Ativo) { Dizer ("  [ok]   {0}: {1}" -f $l.Rotulo, $l.Pasta) }
    else { Dizer ("  [pula] {0}: {1}" -f $l.Rotulo, $l.Motivo); [void]$avisos.Add("$($l.Rotulo) foi pulado: $($l.Motivo).") }
}
$ativos = @($lugares | Where-Object { $_.Ativo })
if ($ativos.Count -lt 2) {
    Dizer ''
    Dizer 'Preciso de pelo menos 2 lugares disponiveis para comparar. Nada foi alterado.'
    return
}

# ---------- pasta de backup ----------
$pastaBackups = Cfg1 $cfg 'Backups' 'AUTO'
if ($pastaBackups -eq 'AUTO') {
    $base = $null
    if ($pend) { $base = Split-Path $pend -Parent } elseif ($drv) { $base = Split-Path $drv -Parent }
    if ($base) { $pastaBackups = Join-Path $base 'Ultra-formulario (backups)\banco' }
    else { $pastaBackups = Join-Path $env:USERPROFILE 'ultra-formulario-banco-backups' }
}
$carimbo = (Get-Date).ToString('yyyy-MM-dd_HH-mm-ss')
$pastaEstaRodada = Join-Path $pastaBackups $carimbo
$fezBackup = $false

function Fazer-Backup($origemArq, $rotuloLugar, $nomeArq) {
    if (-not (Test-Path -LiteralPath $pastaEstaRodada)) { New-Item -ItemType Directory -Path $pastaEstaRodada -Force | Out-Null }
    $seguro = ($rotuloLugar -replace '[^A-Za-z0-9]+', '')
    $dest = Join-Path $pastaEstaRodada ("{0}_{1}" -f $seguro, $nomeArq)
    Copy-Item -LiteralPath $origemArq -Destination $dest
    if ((Hash-Arq $origemArq) -ne (Hash-Arq $dest)) { throw "Backup nao confere: $dest" }
    $script:fezBackup = $true
    return $dest
}

# ---------- comparar e copiar ----------
$precisaPush = $false
$datasGit = @{}

foreach ($a in $Arquivos) {
    Dizer ''
    Dizer ("--- {0} ---" -f $a.Nome)
    $infos = @{}
    foreach ($l in $ativos) {
        $nomeNoLugar = if ($l.Tipo -eq 'git') { $a.NomeRepo } else { $a.Nome }
        $cam = Join-Path $l.Pasta $nomeNoLugar
        $inf = @{ Lugar = $l; Caminho = $cam; Existe = (Test-Path -LiteralPath $cam -PathType Leaf) }
        if ($inf.Existe) {
            $fi = Get-Item -LiteralPath $cam
            $inf.Tam = $fi.Length
            $inf.Hash = Hash-Arq $cam
            $inf.Data = $fi.LastWriteTimeUtc
            if ($l.Tipo -eq 'git') {
                $sujo = Git-Rodar $l.Pasta @('status', '--porcelain', '--', $a.NomeRepo)
                if (-not $sujo.Saida) {
                    $d = Git-Rodar $l.Pasta @('log', '-1', '--format=%cI', '--', $a.NomeRepo)
                    if ($d.Codigo -eq 0 -and $d.Saida) { $inf.Data = ([DateTimeOffset]::Parse($d.Saida)).UtcDateTime }
                }
            }
            Dizer ("  {0,-17} {1,9:N0} bytes  modificado em {2}" -f $l.Rotulo, $inf.Tam, (Hora $inf.Data))
        } else {
            Dizer ("  {0,-17} (nao tem este arquivo)" -f $l.Rotulo)
        }
        $infos[$l.Id] = $inf
    }
    $existentes = @($infos.Values | Where-Object { $_.Existe })
    if ($existentes.Count -eq 0) { Dizer '  Nao existe em nenhum lugar. Nada a fazer.'; [void]$resumo.Add("$($a.Nome): nao existe em nenhum lugar."); continue }

    $hashes = @($existentes | ForEach-Object { $_.Hash } | Sort-Object -Unique)
    $faltam = @($infos.Values | Where-Object { -not $_.Existe })
    if ($hashes.Count -eq 1 -and $faltam.Count -eq 0) {
        Dizer '  Tudo igual. Nada a fazer.'
        [void]$resumo.Add("$($a.Nome): igual em todos os lugares, nada mudou.")
        continue
    }

    $maisNovo = $existentes | Sort-Object @{ Expression = { $_.Data }; Descending = $true }, @{ Expression = { $_.Lugar.Prioridade }; Ascending = $true } | Select-Object -First 1
    # empate de data (menos de 3 s) com conteudo diferente: nao decide sozinho
    $empate = @($existentes | Where-Object { $_.Hash -ne $maisNovo.Hash -and ([Math]::Abs(($_.Data - $maisNovo.Data).TotalSeconds) -lt 3) })
    if ($empate.Count -gt 0) {
        Aviso "$($a.Nome): $($maisNovo.Lugar.Rotulo) e $($empate[0].Lugar.Rotulo) tem datas quase iguais mas conteudos diferentes. Nao copiei nada; confira qual vale."
        [void]$resumo.Add("$($a.Nome): CONFLITO (datas iguais, conteudos diferentes). Nada foi copiado.")
        continue
    }
    # trava de seguranca: vazio ou muito menor
    $maior = 0
    foreach ($e in $existentes) { if ($e.Tam -gt $maior) { $maior = $e.Tam } }
    if ($maisNovo.Tam -eq 0 -or ($maior -gt 0 -and ($maisNovo.Tam * 100 / $maior) -lt $pctMin)) {
        Aviso "$($a.Nome): o arquivo mais novo ($($maisNovo.Lugar.Rotulo)) esta vazio ou bem menor que os outros. Nao copiei nada por seguranca."
        [void]$resumo.Add("$($a.Nome): ARQUIVO MAIS NOVO SUSPEITO (vazio/muito menor). Nada foi copiado.")
        continue
    }

    Dizer ("  Mais novo: {0} ({1})" -f $maisNovo.Lugar.Rotulo, (Hora $maisNovo.Data))
    $destinos = @($infos.Values | Where-Object { (-not $_.Existe) -or ($_.Hash -ne $maisNovo.Hash) })
    $feitos = New-Object System.Collections.ArrayList
    foreach ($d in $destinos) {
        $rot = $d.Lugar.Rotulo
        $bk = $null
        $txtMais = if ($d.Existe) { "substituir (backup antes)" } else { "criar" }
        if ($Simular) {
            Dizer ("  [simulacao] {0}: iria {1}" -f $rot, $txtMais)
            [void]$feitos.Add("$rot (so simulado)")
            continue
        }
        try {
            if ($d.Existe) {
                $bk = Fazer-Backup $d.Caminho $rot $a.Nome
                Dizer ("  Backup do arquivo antigo de {0}: {1}" -f $rot, $bk)
            }
            Copy-Item -LiteralPath $maisNovo.Caminho -Destination $d.Caminho -Force
            try { (Get-Item -LiteralPath $d.Caminho).LastWriteTimeUtc = $maisNovo.Data } catch {}
            if ((Hash-Arq $d.Caminho) -ne $maisNovo.Hash) { throw 'o arquivo copiado nao confere com o original' }
            Dizer ("  Copiado para {0} (conferido)" -f $rot)
            [void]$feitos.Add($rot)
            if ($d.Lugar.Tipo -eq 'git') { $precisaPush = $true; $datasGit[$a.NomeRepo] = $maisNovo.Data }
        } catch {
            Aviso ("{0}: falhou em {1}: {2}" -f $a.Nome, $rot, $_.Exception.Message)
            if ($d.Existe -and $bk) {
                try { Copy-Item -LiteralPath $bk -Destination $d.Caminho -Force; Dizer "  Restaurei o arquivo antigo de $rot a partir do backup." } catch {}
            }
        }
    }
    [void]$resumo.Add(("{0}: o mais novo era o do {1} ({2}). {3}: {4}" -f $a.Nome, $maisNovo.Lugar.Rotulo, (Hora $maisNovo.Data), $(if ($Simular) { 'Seria atualizado' } else { 'Atualizado' }), ($feitos -join ', ')))
}

# ---------- GitHub: commit e envio ----------
if ($gh.Ativo -and -not $Simular) {
    $pg = $gh.Pasta
    $st = Git-Rodar $pg @('status', '--porcelain')
    if ($st.Saida) {
        # Um commit por arquivo; a data do commit = data do arquivo copiado, para a comparacao de datas continuar valendo
        foreach ($a in $Arquivos) {
            $sujo = Git-Rodar $pg @('status', '--porcelain', '--', $a.NomeRepo)
            if (-not $sujo.Saida) { continue }
            $dt = if ($datasGit.ContainsKey($a.NomeRepo)) { $datasGit[$a.NomeRepo] } else { (Get-Item -LiteralPath (Join-Path $pg $a.NomeRepo)).LastWriteTimeUtc }
            $dataIso = $dt.ToString('yyyy-MM-ddTHH:mm:ssZ')
            $env:GIT_AUTHOR_DATE = $dataIso; $env:GIT_COMMITTER_DATE = $dataIso
            try {
                [void](Git-Rodar $pg @('add', '--', $a.NomeRepo))
                $r = Git-Rodar $pg @('commit', '-m', ('Banco sincronizado em ' + (Get-Date).ToString('yyyy-MM-dd HH:mm') + ': ' + $a.NomeRepo))
                if ($r.Codigo -ne 0) { Aviso "GitHub: nao consegui registrar a mudanca ($($r.Saida))." } else { $precisaPush = $true }
            } finally { Remove-Item Env:GIT_AUTHOR_DATE, Env:GIT_COMMITTER_DATE -ErrorAction SilentlyContinue }
        }
    }
    $adiante = Git-Rodar $pg @('rev-list', '--count', '@{u}..HEAD')
    if ($precisaPush -or ($adiante.Codigo -eq 0 -and [int]$adiante.Saida -gt 0)) {
        $r = Git-Rodar $pg @('push')
        if ($r.Codigo -eq 0) { Dizer ''; Dizer 'GitHub: enviado.' ; [void]$resumo.Add('GitHub: mudancas enviadas ao repositorio privado.') }
        else { Aviso 'GitHub: nao consegui enviar (sem internet ou sem login?). A mudanca ficou guardada e sera enviada na proxima vez.' }
    }
}

# ---------- limpar backups antigos (so as pastas de data e hora criadas por este script) ----------
if (-not $Simular -and (Test-Path -LiteralPath $pastaBackups)) {
    $antigas = @(Get-ChildItem -LiteralPath $pastaBackups -Directory | Where-Object { $_.Name -match '^\d{4}-\d{2}-\d{2}_\d{2}-\d{2}-\d{2}$' } | Sort-Object Name -Descending)
    if ($antigas.Count -gt $guardar) {
        $antigas | Select-Object -Skip $guardar | ForEach-Object { Remove-Item -LiteralPath $_.FullName -Recurse -Force }
        Dizer ("Backups antigos removidos: {0} (guardando os {1} mais recentes)." -f ($antigas.Count - $guardar), $guardar)
    }
}

# ---------- resumo ----------
Dizer ''
Dizer '=============================================='
Dizer ' RESUMO'
Dizer '=============================================='
foreach ($r in $resumo) { Dizer ("  - " + $r) }
if ($fezBackup) { Dizer ("  - Backup dos arquivos antigos em: " + $pastaEstaRodada) }
if ($Simular) { Dizer '  - Foi so uma conferencia: nada foi copiado.' }
if ($avisos.Count -gt 0) {
    Dizer ''
    Dizer ' Atencao:'
    foreach ($v in $avisos) { Dizer ("  * " + $v) }
}
if ($lugares | Where-Object { $_.Id -eq 'Drive' -and $_.Ativo } ) {
    if (-not $Simular) { Dizer ''; Dizer ' (O Google Drive termina de enviar sozinho; confira o icone do Drive na barra de tarefas.)' }
}
Dizer ''
