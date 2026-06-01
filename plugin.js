window.RochePlugin.register({
  id: "roche-memory-checker",
  name: "Roche 记忆体检助手",
  version: "1.0.0",
  apps: [
    {
      id: "memory-checker-home",
      name: "体检助手",
      icon: "extension",
      async mount(container, roche) {
        container.innerHTML = `
          <div class="roche-plugin-memory-checker" style="padding:15px;font-family:sans-serif;">
            <h2>Roche 记忆体检助手</h2>
            <button id="loadData">加载当前角色数据</button>
            <div id="summary" style="margin-top:15px;"></div>
            <button id="analyze" style="margin-top:10px;">AI分析建议</button>
            <pre id="result" style="margin-top:15px;white-space:pre-wrap;"></pre>
          </div>
        `;

        let currentData = {};

        const loadDataBtn = container.querySelector("#loadData");
        const analyzeBtn = container.querySelector("#analyze");
        const summaryEl = container.querySelector("#summary");
        const resultEl = container.querySelector("#result");

        loadDataBtn.onclick = async () => {
          summaryEl.textContent = "加载中...";
          const chars = await roche.character.list();
          const activeChar = chars[0]; // 默认选择第一个角色
          const charData = await roche.character.get(activeChar.id);
          const userData = await roche.persona.getActiveUserPersona();
          const shortTerm = await roche.memory.getShortTerm({ conversationId: charData.conversationId, limit: 50 });
          const longTerm = await roche.memory.getLongTerm({ conversationId: charData.conversationId, limit: 100 });

          currentData = {
            charData,
            userData,
            shortTerm,
            longTerm
          };

          summaryEl.innerHTML = `
            <b>角色：</b> ${charData.handle || charData.name} <br>
            <b>用户：</b> ${userData.name} <br>
            <b>短期记忆：</b> ${shortTerm.length} 条 <br>
            <b>长期记忆：</b> 核心 ${longTerm.core.length} 条，事实 ${longTerm.facts.length} 条
          `;
        };

        analyzeBtn.onclick = async () => {
          if (!currentData.charData) {
            resultEl.textContent = "请先加载角色数据！";
            return;
          }

          resultEl.textContent = "分析中...";

          const messages = [
            {
              role: "user",
              content: `
请基于以下数据帮我分析体检建议：
角色人设：${currentData.charData.persona || ""}
用户人设：${currentData.userData.persona || ""}
短期记忆：${JSON.stringify(currentData.shortTerm, null, 2)}
长期记忆核心：${JSON.stringify(currentData.longTerm.core, null, 2)}
长期记忆事实：${JSON.stringify(currentData.longTerm.facts, null, 2)}

请给出：
1. 哪些记忆重复
2. 哪些记忆太废话
3. 哪些设定冲突
4. 哪些应该保留
5. 哪些可以压缩
不要自动写入 Roche 主记忆，只输出建议
`
            }
          ];

          const aiResult = await roche.ai.chat({ messages, temperature: 0.7 });
          resultEl.textContent = aiResult.text;
        };
      },
      async unmount(container, roche) {
        container.replaceChildren();
      }
    }
  ]
});
