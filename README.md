# Vialink — publicação preliminar

PWA mobile com autenticação Supabase, fotos privadas, fluxo de posse e registros de frota. O site é estático (Vite/React) para Hostinger. Gravações passam pela Edge Function `fleet`, que identifica o usuário, verifica seu papel e registra a alteração com controle de versão no Postgres.

## Atenção: publicação pelo Git da Hostinger

**O `index.html` da raiz deste projeto é código-fonte, não a página pronta.** Ele carrega `/src/main.tsx`, que depende do Vite. Se o Git da hospedagem apenas copiar este repositório para `public_html`, o navegador não conseguirá executar o TypeScript. Para hospedagem estática, use o pacote separado `vialink-publicacao-hostinger.zip`: coloque **seu conteúdo diretamente na raiz do repositório conectado ao Git da Hostinger**. Ele já contém `index.html` compilado e a pasta `assets/`. Configure `config.js` conforme abaixo. Alternativamente, configure o serviço Web App da Hostinger para executar `npm run build` e servir `dist/`.

No pacote compilado, edite apenas os dois valores públicos de `config.js`:

```js
window.__VIALINK_CONFIG__ = {
  supabaseUrl: "https://SEU-PROJETO.supabase.co",
  supabaseAnonKey: "SUA_CHAVE_ANON_OU_PUBLISHABLE"
};
```

Se a tela disser “Configure a URL e a chave pública”, o build está no lugar certo, mas falta preencher `config.js`. Se disser “Carregando o aplicativo” indefinidamente, confira se `index.html` e `assets/` estão juntos na raiz do domínio. Limpe o cache do PWA ou atualize a página depois de trocar os arquivos.

## Preparar Supabase

1. Crie um projeto Supabase e habilite e-mail/senha em **Authentication**. Defina a URL pública da aplicação em **URL Configuration → Site URL** e adicione a mesma origem em **Redirect URLs**. Configure o SMTP para entregar convites e recuperação de senha antes de convidar a equipe.
2. Execute `supabase/migrations/20260924000000_vialink.sql` no SQL Editor, ou use o CLI: `supabase link --project-ref SEU_PROJECT_REF` e `supabase db push`. A migração cria as tabelas, a função de gravação atômica e o bucket privado de evidências.
3. Crie a primeira conta pelo formulário da aplicação ou em **Authentication → Users**. Copie o UUID do usuário. No SQL Editor execute:

   ```sql
   select public.bootstrap_vialink('UUID_DO_USUARIO'::uuid, 'Nome da empresa');
   ```

   A primeira conta vira Administrador. Depois, cadastre obras, condutores e veículos em **Configurações** e convide os condutores por e-mail. O nome escolhido no convite vincula a conta ao cadastro do condutor.
4. Configure a origem permitida na Edge Function. Exemplo:

   ```bash
   supabase secrets set ALLOWED_ORIGINS=https://frota.suaempresa.com.br
   supabase functions deploy fleet
   ```

   Para desenvolvimento, inclua também `http://localhost:5173` separado por vírgula. `SUPABASE_URL`, `SUPABASE_ANON_KEY` e `SUPABASE_SERVICE_ROLE_KEY` são providos ao ambiente da função pelo Supabase. A chave de serviço é **somente do servidor**.

## Instalar e publicar o site

```bash
cp .env.example .env.local
# preencher VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY
npm install
npm test
npm run build
```

O resultado publicável está em `dist/`. Em Hostinger Web App conectado ao GitHub, selecione a branch `main`, configure as duas variáveis `VITE_*` ou preencha `public/config.js`, use `npm install && npm run build` e a pasta de saída `dist`. Em hospedagem compartilhada, envie **o conteúdo** de `dist/` para `public_html`; a conexão Git simples pode baixar o código-fonte sem compilar, portanto use o pacote `vialink-publicacao-hostinger.zip` ou o artefato `vialink-static` do workflow. Use HTTPS no domínio final: câmera e instalação PWA dependem de contexto seguro. Configure a mesma URL em `ALLOWED_ORIGINS` e no Auth do Supabase.

Não inclua `SUPABASE_SERVICE_ROLE_KEY` no GitHub, em variáveis `VITE_*` ou no navegador. As duas variáveis `VITE_*` são públicas e devem conter apenas URL e chave anon/publishable. O workflow gera um artefato estático; não publica automaticamente nem migra o banco. Rode a migração e faça o deploy da função antes da primeira publicação.

## Fluxos disponíveis

- Login, recuperação de senha, convite de colaboradores e perfis vinculados à empresa.
- Cadastro de veículos, condutores e obras; QR por veículo, leitura por câmera ou câmera nativa; detalhes com posse e histórico.
- Solicitação → aceite → checklist de entrega com cinco fotos → checklist de recebimento com cinco fotos → nova posse. Gestor pode fazer transferência administrativa justificada.
- Checklist diário, ocorrência crítica com bloqueio, mudança de obra, abastecimento com cupom, consumo entre tanques completos.
- Registro de manutenção, pedágio e multa com identificação pela posse e obra no horário; exportação CSV, custos e conferência de dias com checklist.
- Instalável como PWA; arquivos da interface disponíveis sem conexão. **Gravações e atualização dos dados exigem internet.** Nenhuma ação sensível é enfileirada offline.

## Limites da publicação preliminar

Localização em tempo real exige integração com rastreador; o mapa é apenas referência geográfica e não mostra carros. Não há importação automática de faturas, posto, câmera, telemetria ou cartão corporativo. A bonificação exibe dias registrados e ocorrências, sem calcular um valor: aplique a política interna antes de pagar. Os custos exibidos são registros acumulados, sem conciliação contábil. A operação ainda não foi testada contra um projeto Supabase e um domínio Hostinger reais; após configurar credenciais, valide os fluxos com contas separadas antes de uso geral.
