# Preencher os casos que já estão no sistema

## Respondendo suas dúvidas

**Não precisa importar de novo.** Os textos originais da planilha já estão guardados em cada caso: dos 1.468 casos cadastrados, 1.018 têm o texto de neurolocalização, 1.016 têm suspeitas e 223 têm diagnóstico. O reconhecimento automático pode ser feito em cima do que já está salvo.

**Se você importasse de novo, sim, ficaria tudo duplicado.** A importação atual sempre cria casos novos, sem comparar com o que já existe — você ficaria com quase 3.000 casos.

Hoje só 292 casos têm região marcada, 313 têm suspeita e 41 têm diagnóstico, então a maioria ainda está sem os chips.

## O que vou fazer

Uma tela de "Reconhecimento automático" que roda sobre todos os casos já cadastrados:

1. Botão **"Reconhecer tudo"** que percorre os 1.468 casos (não apenas os 60 primeiros, como hoje), aplica as suas listas de palavras-chave aos textos de neurolocalização, suspeitas e diagnóstico e mostra uma prévia: quantos casos receberiam região, suspeita e diagnóstico, e quantos ficaram sem nenhuma correspondência.
2. Botão **"Aplicar aos casos"** que grava as marcações, em blocos, com barra de progresso. Marcações que o caso já tem são preservadas — nada é apagado nem duplicado.
3. Ao aplicar, as mesmas regras de status entram em ação: caso com categoria de diagnóstico vira **Fechado**; caso com desfecho Óbito ou Eutanásia e sem diagnóstico vira **Sem seguimento**.
4. Uma lista dos casos sem correspondência, com link direto para a ficha, para você completar à mão.

Também vou proteger a importação contra duplicatas: antes de gravar, ela compara nome do paciente + tutor (e o código de origem, quando houver) com o que já existe e mostra quantas linhas são novas e quantas são repetidas, deixando você escolher entre importar só as novas ou tudo.

## Detalhes técnicos

- Novo painel em `/revisao-ia`: busca paginada de `patients` (blocos de 1.000) trazendo `id`, textos livres e vínculos atuais; classificação local via `classificar()` de `src/lib/regras.ts`, sem chamada de IA.
- Gravação em `patient_regions`, `patient_suspicions` e `patient_diagnoses` com `upsert(..., { ignoreDuplicates: true })` em lotes; nomes das categorias resolvidos pelas tabelas de vocabulário (já semeadas com todas as suas categorias).
- Atualização de `status_diagnostico` em lote após aplicar os diagnósticos, seguindo as mesmas regras da ficha.
- O botão "Analisar com IA" continua existindo para os casos que as regras não cobrirem.
- Importação: chave de deduplicação `normalizar(paciente)|normalizar(tutor)` (e `codigo` quando presente) comparada com os casos existentes antes do insert.
