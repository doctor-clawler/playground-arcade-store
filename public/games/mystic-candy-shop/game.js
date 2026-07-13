(() => {
  "use strict";

  const canvas = document.getElementById("game");
  const ctx = canvas.getContext("2d");
  const W = canvas.width;
  const H = canvas.height;
  const DPR = Math.max(1, Math.min(3, window.devicePixelRatio || 1));

  const COLORS = {
    ink: "#fff7e4",
    muted: "#dac29b",
    shadow: "#1a100d",
    panel: "#3c211a",
    panel2: "#583026",
    gold: "#f2bd56",
    amber: "#cc7736",
    mint: "#8ed8a0",
    sky: "#88c5ff",
    berry: "#ff7fa4",
    danger: "#e95d57",
    violet: "#8c6de4",
    teal: "#63c9bd",
    dark: "#17110f",
    line: "#91614d",
  };

  const recipes = [
    {
      id: "brave",
      name: "용기백배 호두과자",
      short: "용기호두",
      need: "election",
      caution: "tenMin",
      ingredients: { starSugar: 2, couragePowder: 1, moonNut: 1 },
      effect: "떨리는 마음을 크게 말할 힘으로 바꾼다.",
      color: COLORS.gold,
    },
    {
      id: "peace",
      name: "사르르 화해 솜사탕",
      short: "화해솜",
      need: "friend",
      caution: "shareClean",
      ingredients: { cloudSyrup: 2, starSugar: 1 },
      effect: "나누어 먹으면 마음속 앙금이 녹는다.",
      color: COLORS.sky,
    },
    {
      id: "memory",
      name: "쏙쏙 암기 젤리",
      short: "암기젤리",
      need: "test",
      caution: "redFirst",
      ingredients: { memoryBerry: 2, starSugar: 1 },
      effect: "책 위에 올렸던 내용을 또렷하게 떠올린다.",
      color: COLORS.berry,
    },
  ];

  const ingredientMeta = {
    starSugar: { name: "별빛 설탕", icon: "star", color: COLORS.gold },
    couragePowder: { name: "용기의 가루", icon: "spark", color: COLORS.amber },
    cloudSyrup: { name: "구름 시럽", icon: "drop", color: COLORS.sky },
    moonNut: { name: "달빛 호두", icon: "nut", color: "#db9b5c" },
    memoryBerry: { name: "기억 열매", icon: "berry", color: COLORS.berry },
  };

  const stickers = [
    { id: "tenMin", name: "10분 전에 먹기", hint: "일찍 먹으면 집에서 소리친다." },
    { id: "shareClean", name: "깨끗하게 나눠 먹기", hint: "침이 묻으면 욕심이 붙는다." },
    { id: "redFirst", name: "빨간 젤리 먼저", hint: "순서를 틀리면 어제 일도 잊는다." },
  ];

  const customers = [
    {
      id: "election",
      name: "민서",
      type: "초등학생",
      worry: "내일 반장 선거인데 목소리가 떨려요.",
      icon: "lion",
      reward: 16,
      story: "민서는 교실 앞에서 또박또박 공약을 말했다.",
    },
    {
      id: "friend",
      name: "준호",
      type: "초등학생",
      worry: "친구랑 싸웠는데 먼저 말을 못 걸겠어요.",
      icon: "heart",
      reward: 14,
      story: "준호와 친구는 솜사탕을 반으로 나누며 웃었다.",
    },
    {
      id: "test",
      name: "아린",
      type: "초등학생",
      worry: "받아쓰기 시험 단어가 자꾸 헷갈려요.",
      icon: "book",
      reward: 15,
      story: "아린은 외운 단어를 또렷하게 떠올렸다.",
    },
    {
      id: "cat",
      name: "말하는 고양이 손님",
      type: "수수께끼",
      worry: "주인이 잃어버린 용기를 찾아 달라냥.",
      icon: "cat",
      reward: 18,
      story: "검은 고양이는 작은 행운 동전을 두고 사라졌다.",
    },
  ];

  const state = {
    mode: "shop",
    day: 1,
    coins: 26,
    reputation: 3,
    maxReputation: 5,
    sales: 0,
    ingredients: {
      starSugar: 2,
      couragePowder: 1,
      cloudSyrup: 1,
      moonNut: 1,
      memoryBerry: 0,
    },
    inventory: { brave: 0, peace: 0, memory: 0 },
    upgrades: { shelf: 1, garden: 1, cat: 1 },
    customerIndex: 0,
    selectedRecipe: null,
    selectedSnack: null,
    selectedSticker: null,
    stir: 0,
    gardenTimer: 0,
    collectItems: [],
    bushRub: [0, 0, 0],
    message: "손님의 고민에 맞는 과자를 만들고 주의사항까지 붙여 주세요.",
    toastTimer: 4,
    effects: [],
    mission: null,
    codex: [],
    screenShake: 0,
  };

  let hitAreas = [];
  let pointer = { down: false, x: 0, y: 0, lastX: 0, lastY: 0 };
  let lastTime = performance.now();

  function setupCanvasScale() {
    canvas.width = Math.round(W * DPR);
    canvas.height = Math.round(H * DPR);
    canvas.style.width = "100%";
    canvas.style.height = "100%";
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
  }

  function currentCustomer() {
    return customers[state.customerIndex % customers.length];
  }

  function recipeById(id) {
    return recipes.find((recipe) => recipe.id === id);
  }

  function canAffordIngredients(recipe) {
    return Object.entries(recipe.ingredients).every(([key, amount]) => (state.ingredients[key] || 0) >= amount);
  }

  function spendIngredients(recipe) {
    Object.entries(recipe.ingredients).forEach(([key, amount]) => {
      state.ingredients[key] -= amount;
    });
  }

  function nextCustomer() {
    state.customerIndex = (state.customerIndex + 1) % customers.length;
    state.selectedSnack = null;
    state.selectedSticker = null;
  }

  function setMessage(text, seconds = 3) {
    state.message = text;
    state.toastTimer = seconds;
  }

  function addEffect(x, y, text, color = COLORS.gold) {
    state.effects.push({ x, y, text, color, life: 1.2, vy: -22 });
  }

  function formatCost(recipe) {
    return Object.entries(recipe.ingredients)
      .map(([key, amount]) => `${ingredientMeta[key].name} ${amount}`)
      .join(" / ");
  }

  function withObjectParticle(text) {
    const last = text.charCodeAt(text.length - 1);
    if (last < 0xac00 || last > 0xd7a3) return `${text}을`;
    return (last - 0xac00) % 28 === 0 ? `${text}를` : `${text}을`;
  }

  function update(dt) {
    state.toastTimer = Math.max(0, state.toastTimer - dt);
    state.screenShake = Math.max(0, state.screenShake - dt * 16);
    updateEffects(dt);
    if (state.mode === "garden") updateGarden(dt);
    if (state.mission) updateMission(dt);
  }

  function updateEffects(dt) {
    state.effects = state.effects.filter((effect) => {
      effect.life -= dt;
      effect.y += effect.vy * dt;
      return effect.life > 0;
    });
  }

  function updateGarden(dt) {
    state.gardenTimer -= dt;
    if (state.gardenTimer <= 0) {
      spawnIngredient();
      state.gardenTimer = Math.max(0.55, 1.25 - state.upgrades.garden * 0.12);
    }

    state.collectItems = state.collectItems.filter((item) => {
      item.y += item.speed * dt;
      item.spin += dt * 4;
      item.pulse += dt;
      if (item.y > 688) {
        addEffect(item.x, 680, "놓침", COLORS.danger);
        return false;
      }
      return true;
    });
  }

  function spawnIngredient() {
    const pool = ["starSugar", "starSugar", "couragePowder", "cloudSyrup", "moonNut", "memoryBerry"];
    const type = pool[Math.floor(Math.random() * pool.length)];
    state.collectItems.push({
      type,
      x: 60 + Math.random() * 270,
      y: 188,
      r: 19,
      speed: 64 + Math.random() * 42,
      spin: Math.random() * Math.PI,
      pulse: 0,
    });
  }

  function updateMission(dt) {
    state.mission.time -= dt;
    if (state.mission.time <= 0) {
      state.reputation = Math.max(0, state.reputation - 1);
      setMessage("불량 과자가 섞였습니다. 평판이 떨어졌어요.", 3.5);
      state.mission = null;
      state.screenShake = 7;
    }
  }

  function triggerThiefMission() {
    if (state.mission || state.sales < 1 || state.sales % 2 !== 0) return;
    state.mission = {
      type: "thief",
      time: 8,
      x: 245 + Math.random() * 48,
      y: 246 + Math.random() * 36,
    };
    setMessage("수상한 손님이 진열대에 접근합니다. 먼저 찾아 터치하세요.", 4);
  }

  function render() {
    hitAreas = [];
    ctx.save();
    const shakeX = state.screenShake ? (Math.random() - 0.5) * state.screenShake : 0;
    const shakeY = state.screenShake ? (Math.random() - 0.5) * state.screenShake : 0;
    ctx.translate(shakeX, shakeY);
    drawBackground();
    drawTopBar();

    if (state.mode === "shop") drawShop();
    if (state.mode === "garden") drawGarden();
    if (state.mode === "cook") drawCook();
    if (state.mode === "serve") drawServe();
    if (state.mode === "growth") drawGrowth();

    drawBottomNav();
    drawToast();
    drawEffects();
    ctx.restore();
  }

  function drawBackground() {
    const bg = ctx.createLinearGradient(0, 0, 0, H);
    bg.addColorStop(0, "#25140e");
    bg.addColorStop(0.46, "#42221a");
    bg.addColorStop(1, "#15110f");
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, W, H);

    drawCircle(54, 96, 86, "rgba(244, 183, 78, 0.12)");
    drawCircle(332, 122, 108, "rgba(120, 76, 160, 0.18)");
    drawCircle(208, 412, 160, "rgba(61, 199, 180, 0.08)");

    ctx.strokeStyle = "rgba(255, 226, 164, 0.11)";
    ctx.lineWidth = 1;
    for (let i = 0; i < 9; i++) {
      const y = 132 + i * 54;
      ctx.beginPath();
      ctx.moveTo(26, y);
      ctx.quadraticCurveTo(195, y + Math.sin(i) * 12, 364, y - 8);
      ctx.stroke();
    }
  }

  function drawTopBar() {
    drawRoundRect(14, 14, 362, 86, 18, "rgba(30, 18, 14, 0.78)", "rgba(255, 220, 148, 0.22)");
    drawText("기묘한 과자점", 28, 40, 24, COLORS.ink, "bold");
    drawText(`Day ${state.day}`, 298, 39, 13, COLORS.muted, "bold");
    drawPill(26, 58, `동전 ${state.coins}`, COLORS.gold);
    drawPill(119, 58, `평판 ${"★".repeat(state.reputation)}${"☆".repeat(Math.max(0, state.maxReputation - state.reputation))}`, COLORS.mint);
    drawPill(264, 58, `판매 ${state.sales}`, COLORS.sky);
  }

  function drawShop() {
    drawShelf();
    drawCustomerCard(24, 368, 342, currentCustomer());
    drawResourceStrip(24, 540);

    if (state.mission?.type === "thief") {
      const m = state.mission;
      drawThief(m.x, m.y, m.time);
      addButton(m.x - 31, m.y - 49, 74, 92, "", () => chaseThief(), { invisible: true, label: "수상한 손님 쫓아내기" });
    }

    drawPanelHeader("오늘의 일", 28, 640);
    drawText("1. 정원에서 재료를 모으고", 42, 673, 15, COLORS.ink, "bold");
    drawText("2. 솥그릇에서 과자를 만든 뒤", 42, 698, 15, COLORS.ink, "bold");
    drawText("3. 손님 고민과 주의사항을 맞춰 판매하세요.", 42, 723, 15, COLORS.ink, "bold");
  }

  function drawShelf() {
    drawRoundRect(32, 120, 326, 220, 24, "rgba(71, 40, 30, 0.92)", "rgba(255, 218, 143, 0.28)");
    drawText("신비한 진열대", 52, 150, 18, COLORS.ink, "bold");
    drawText("고양이 조수들이 과자를 정리합니다.", 52, 174, 12, COLORS.muted, "normal");
    for (let i = 0; i < 3; i++) {
      const y = 205 + i * 44;
      ctx.strokeStyle = "rgba(255, 219, 157, 0.36)";
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.moveTo(58, y + 23);
      ctx.lineTo(326, y + 23);
      ctx.stroke();
      for (let j = 0; j < 4; j++) {
        const x = 78 + j * 72 + (i % 2) * 14;
        drawCandy(x, y, 15, [COLORS.gold, COLORS.berry, COLORS.sky, COLORS.mint][(i + j) % 4]);
      }
    }
    drawCatHelper(86, 313, COLORS.gold);
    drawCatHelper(276, 313, COLORS.sky);
  }

  function drawCustomerCard(x, y, w, customer) {
    drawRoundRect(x, y, w, 142, 22, "rgba(28, 18, 15, 0.78)", "rgba(255, 234, 180, 0.2)");
    drawAvatar(x + 50, y + 56, customer.icon);
    drawText(`${customer.name} · ${customer.type}`, x + 102, y + 34, 17, COLORS.gold, "bold");
    wrapText(customer.worry, x + 102, y + 62, w - 128, 18, 14, COLORS.ink, "bold");
    drawText("머리 위 고민 아이콘에 맞는 과자가 필요합니다.", x + 102, y + 118, 12, COLORS.muted, "normal");
  }

  function drawResourceStrip(x, y) {
    drawRoundRect(x, y, 342, 76, 18, "rgba(22, 16, 14, 0.72)", "rgba(255, 220, 148, 0.16)");
    const keys = Object.keys(ingredientMeta);
    keys.forEach((key, i) => {
      const meta = ingredientMeta[key];
      const ix = x + 26 + i * 64;
      drawIngredientIcon(meta.icon, ix, y + 28, 15, meta.color);
      drawText(String(state.ingredients[key] || 0), ix - 8, y + 61, 14, COLORS.ink, "bold", "center");
    });
  }

  function drawGarden() {
    drawRoundRect(24, 116, 342, 84, 20, "rgba(31, 59, 41, 0.83)", "rgba(174, 255, 190, 0.24)");
    drawText("행운의 정원", 42, 148, 22, COLORS.ink, "bold");
    drawText("떨어지는 재료를 터치하고 수풀을 문질러 보세요.", 42, 174, 13, COLORS.muted, "normal");

    drawGardenField();
    state.collectItems.forEach((item) => {
      const meta = ingredientMeta[item.type];
      drawIngredientIcon(meta.icon, item.x, item.y, item.r + Math.sin(item.pulse * 5) * 2, meta.color);
      addButton(item.x - item.r - 8, item.y - item.r - 8, item.r * 2 + 16, item.r * 2 + 16, "", () => collectItem(item), {
        invisible: true,
        label: meta.name,
      });
    });

    [0, 1, 2].forEach((i) => {
      const x = 76 + i * 112;
      const y = 632;
      drawBush(x, y, state.bushRub[i]);
      addButton(x - 43, y - 34, 86, 74, "", () => rubBush(i, x, y), { invisible: true, label: "수풀 문지르기" });
    });
  }

  function drawGardenField() {
    const field = ctx.createLinearGradient(0, 202, 0, 722);
    field.addColorStop(0, "rgba(70, 92, 57, 0.45)");
    field.addColorStop(1, "rgba(38, 69, 47, 0.88)");
    drawRoundRect(24, 214, 342, 508, 26, field, "rgba(172, 255, 184, 0.2)");

    ctx.strokeStyle = "rgba(255, 248, 214, 0.13)";
    ctx.lineWidth = 2;
    for (let i = 0; i < 5; i++) {
      ctx.beginPath();
      ctx.moveTo(36 + i * 72, 228);
      ctx.bezierCurveTo(74 + i * 45, 342, 10 + i * 88, 468, 44 + i * 68, 710);
      ctx.stroke();
    }
  }

  function drawCook() {
    drawRoundRect(24, 116, 342, 92, 20, "rgba(60, 35, 64, 0.82)", "rgba(224, 188, 255, 0.24)");
    drawText("요리조리 마법 솥그릇", 42, 148, 21, COLORS.ink, "bold");
    drawText("레시피를 고르고 솥을 빙글빙글 저어 완성하세요.", 42, 175, 13, COLORS.muted, "normal");

    recipes.forEach((recipe, i) => {
      const y = 228 + i * 86;
      const afford = canAffordIngredients(recipe);
      const selected = state.selectedRecipe === recipe.id;
      drawRecipeButton(recipe, y, afford, selected);
      addButton(28, y, 334, 68, recipe.name, () => selectRecipe(recipe), { label: recipe.name });
    });

    drawCauldron(195, 566, state.selectedRecipe ? recipeById(state.selectedRecipe).color : COLORS.violet);
    if (state.selectedRecipe) {
      drawText(`젓기 ${Math.floor(state.stir)}%`, 195, 656, 18, COLORS.ink, "bold", "center");
      drawProgress(86, 674, 218, 16, state.stir / 100, COLORS.gold);
      addButton(74, 468, 242, 190, "솥 젓기", () => stirCauldron(18), { invisible: true, label: "솥 젓기" });
    } else {
      drawText("만들 과자를 먼저 고르세요.", 195, 655, 15, COLORS.muted, "bold", "center");
    }
  }

  function drawRecipeButton(recipe, y, afford, selected) {
    const fill = selected ? "rgba(246, 190, 82, 0.23)" : "rgba(28, 20, 18, 0.78)";
    drawRoundRect(28, y, 334, 68, 18, fill, afford ? "rgba(255, 228, 160, 0.24)" : "rgba(180, 92, 80, 0.3)");
    drawCandy(57, y + 34, 17, recipe.color);
    drawText(recipe.name, 84, y + 25, 15, afford ? COLORS.ink : "#b9a695", "bold");
    drawText(formatCost(recipe), 84, y + 49, 11, COLORS.muted, "normal");
    drawText(afford ? "제조 가능" : "재료 부족", 302, y + 43, 12, afford ? COLORS.mint : COLORS.danger, "bold", "center");
  }

  function drawServe() {
    const customer = currentCustomer();
    drawCustomerCard(24, 116, 342, customer);
    drawPanelHeader("과자 선택", 28, 286);
    recipes.forEach((recipe, i) => {
      const x = 28 + i * 112;
      const count = state.inventory[recipe.id] || 0;
      const selected = state.selectedSnack === recipe.id;
      drawSmallChoice(x, 318, 102, 82, recipe.short, count, recipe.color, selected, count > 0);
      addButton(x, 318, 102, 82, recipe.short, () => selectSnack(recipe), { label: recipe.name });
    });

    drawPanelHeader("주의사항 스티커", 28, 424);
    stickers.forEach((sticker, i) => {
      const y = 456 + i * 58;
      const selected = state.selectedSticker === sticker.id;
      drawStickerChoice(28, y, sticker, selected);
      addButton(28, y, 334, 46, sticker.name, () => {
        state.selectedSticker = sticker.id;
        setMessage(`${sticker.name} 스티커를 골랐습니다.`, 1.8);
      });
    });

    drawButton(58, 655, 274, 54, "포장해서 판매", COLORS.gold, () => sellSnack());
  }

  function drawGrowth() {
    drawRoundRect(24, 116, 342, 90, 20, "rgba(48, 38, 28, 0.83)", "rgba(255, 222, 150, 0.25)");
    drawText("행운 동전과 움직이는 도감", 42, 148, 20, COLORS.ink, "bold");
    drawText("판매 보상으로 가게와 정원을 키우세요.", 42, 175, 13, COLORS.muted, "normal");

    const upgrades = [
      { id: "shelf", name: "진열대 확장", desc: "판매 동전 +2", cost: 22 + state.upgrades.shelf * 10 },
      { id: "garden", name: "정원 반짝임", desc: "재료가 더 자주 떨어짐", cost: 18 + state.upgrades.garden * 8 },
      { id: "cat", name: "고양이 앞치마", desc: "성공 판매 시 평판 회복 확률", cost: 20 + state.upgrades.cat * 9 },
    ];

    upgrades.forEach((upgrade, i) => {
      const y = 232 + i * 82;
      drawUpgrade(upgrade, y);
      addButton(28, y, 334, 64, upgrade.name, () => buyUpgrade(upgrade), { label: upgrade.name });
    });

    drawPanelHeader("해결한 이야기", 28, 506);
    if (state.codex.length === 0) {
      drawText("아직 열린 후기가 없습니다.", 42, 542, 15, COLORS.muted, "bold");
      drawText("정확한 과자와 스티커를 골라 손님을 도와주세요.", 42, 568, 13, COLORS.muted, "normal");
    } else {
      state.codex.slice(-3).forEach((entry, i) => {
        drawRoundRect(36, 532 + i * 58, 318, 48, 14, "rgba(24, 18, 15, 0.68)", "rgba(255, 222, 150, 0.13)");
        drawText(entry.title, 52, 552 + i * 58, 14, COLORS.gold, "bold");
        drawText(entry.text, 52, 572 + i * 58, 11, COLORS.muted, "normal");
      });
    }
  }

  function drawUpgrade(upgrade, y) {
    drawRoundRect(28, y, 334, 64, 18, "rgba(28, 20, 18, 0.78)", "rgba(255, 228, 160, 0.2)");
    drawText(upgrade.name, 48, y + 26, 16, COLORS.ink, "bold");
    drawText(upgrade.desc, 48, y + 48, 12, COLORS.muted, "normal");
    const affordable = state.coins >= upgrade.cost;
    drawText(`${upgrade.cost}동전`, 306, y + 38, 13, affordable ? COLORS.gold : COLORS.danger, "bold", "center");
  }

  function drawBottomNav() {
    drawRoundRect(14, 752, 362, 76, 24, "rgba(17, 12, 10, 0.88)", "rgba(255, 234, 180, 0.18)");
    const buttons = [
      { id: "shop", label: "가게", icon: "shop" },
      { id: "garden", label: "정원", icon: "leaf" },
      { id: "cook", label: "제조", icon: "pot" },
      { id: "serve", label: "응대", icon: "talk" },
      { id: "growth", label: "성장", icon: "coin" },
    ];

    buttons.forEach((button, i) => {
      const x = 28 + i * 69;
      const selected = state.mode === button.id;
      drawRoundRect(x, 764, 58, 52, 16, selected ? "rgba(242, 189, 86, 0.28)" : "rgba(255, 247, 224, 0.06)", selected ? "rgba(255, 238, 190, 0.38)" : "rgba(255,255,255,0.04)");
      drawNavIcon(button.icon, x + 29, 782, selected ? COLORS.gold : COLORS.muted);
      drawText(button.label, x + 29, 807, 11, selected ? COLORS.ink : COLORS.muted, "bold", "center");
      addButton(x, 764, 58, 52, button.label, () => {
        if (state.mode !== button.id) {
          state.effects = [];
          state.screenShake = 0;
        }
        state.mode = button.id;
        if (button.id === "garden" && state.collectItems.length === 0) spawnIngredient();
      }, { label: button.label });
    });
  }

  function drawToast() {
    if (!state.toastTimer) return;
    const alpha = Math.min(1, state.toastTimer / 0.3);
    ctx.save();
    ctx.globalAlpha = alpha;
    drawRoundRect(22, 704, 346, 38, 16, "rgba(20, 14, 12, 0.9)", "rgba(255, 223, 160, 0.16)");
    drawText(state.message, 195, 728, 12, COLORS.ink, "bold", "center", 326);
    ctx.restore();
  }

  function drawEffects() {
    state.effects.forEach((effect) => {
      ctx.save();
      ctx.globalAlpha = Math.max(0, Math.min(1, effect.life));
      drawText(effect.text, effect.x, effect.y, 16, effect.color, "bold", "center");
      ctx.restore();
    });
  }

  function drawButton(x, y, w, h, label, color, callback) {
    drawRoundRect(x, y, w, h, 18, color, "rgba(255,255,255,0.24)");
    drawText(label, x + w / 2, y + h / 2 + 6, 18, "#20130d", "bold", "center");
    addButton(x, y, w, h, label, callback, { label });
  }

  function addButton(x, y, w, h, label, callback, options = {}) {
    hitAreas.push({ x, y, w, h, label: options.label || label, callback, invisible: options.invisible || false });
  }

  function drawPanelHeader(text, x, y) {
    drawText(text, x, y, 17, COLORS.gold, "bold");
    ctx.strokeStyle = "rgba(255, 222, 150, 0.2)";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(x, y + 13);
    ctx.lineTo(362, y + 13);
    ctx.stroke();
  }

  function drawSmallChoice(x, y, w, h, label, count, color, selected, enabled) {
    drawRoundRect(x, y, w, h, 16, selected ? "rgba(242, 189, 86, 0.24)" : "rgba(26, 18, 16, 0.78)", enabled ? "rgba(255, 228, 160, 0.24)" : "rgba(180, 92, 80, 0.24)");
    drawCandy(x + w / 2, y + 27, 17, color);
    drawText(label, x + w / 2, y + 56, 12, enabled ? COLORS.ink : "#a49488", "bold", "center");
    drawText(`x${count}`, x + w / 2, y + 73, 11, enabled ? COLORS.gold : COLORS.danger, "bold", "center");
  }

  function drawStickerChoice(x, y, sticker, selected) {
    drawRoundRect(x, y, 334, 46, 14, selected ? "rgba(242, 189, 86, 0.23)" : "rgba(28, 20, 18, 0.76)", "rgba(255, 228, 160, 0.18)");
    drawText(sticker.name, x + 18, y + 20, 14, COLORS.ink, "bold");
    drawText(sticker.hint, x + 18, y + 38, 10, COLORS.muted, "normal");
    if (selected) drawText("선택", x + 298, y + 29, 12, COLORS.gold, "bold", "center");
  }

  function drawProgress(x, y, w, h, pct, color) {
    drawRoundRect(x, y, w, h, h / 2, "rgba(255,255,255,0.1)", "rgba(255,255,255,0.08)");
    drawRoundRect(x, y, Math.max(h, w * Math.max(0, Math.min(1, pct))), h, h / 2, color, null);
  }

  function drawPill(x, y, label, color) {
    drawRoundRect(x, y, 84, 24, 12, "rgba(255, 247, 224, 0.08)", "rgba(255, 247, 224, 0.08)");
    drawText(label, x + 42, y + 16, 11, color, "bold", "center");
  }

  function drawRoundRect(x, y, w, h, r, fill, stroke) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
    if (fill) {
      ctx.fillStyle = fill;
      ctx.fill();
    }
    if (stroke) {
      ctx.strokeStyle = stroke;
      ctx.lineWidth = 1.5;
      ctx.stroke();
    }
  }

  function drawCircle(x, y, r, color) {
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
  }

  function drawText(text, x, y, size, color, weight = "normal", align = "left", maxWidth) {
    ctx.fillStyle = color;
    ctx.font = `${weight} ${size}px Inter, system-ui, -apple-system, "Apple SD Gothic Neo", "Noto Sans KR", sans-serif`;
    ctx.textAlign = align;
    ctx.textBaseline = "alphabetic";
    if (maxWidth) {
      const fitted = fitText(String(text), maxWidth, size, weight);
      ctx.fillText(fitted, x, y);
    } else {
      ctx.fillText(String(text), x, y);
    }
  }

  function fitText(text, maxWidth, size, weight) {
    ctx.font = `${weight} ${size}px Inter, system-ui, -apple-system, "Apple SD Gothic Neo", "Noto Sans KR", sans-serif`;
    if (ctx.measureText(text).width <= maxWidth) return text;
    let out = text;
    while (out.length > 1 && ctx.measureText(`${out}...`).width > maxWidth) out = out.slice(0, -1);
    return `${out}...`;
  }

  function wrapText(text, x, y, maxWidth, lineHeight, size, color, weight = "normal") {
    ctx.font = `${weight} ${size}px Inter, system-ui, -apple-system, "Apple SD Gothic Neo", "Noto Sans KR", sans-serif`;
    ctx.fillStyle = color;
    ctx.textAlign = "left";
    const words = String(text).split(" ");
    let line = "";
    let lineY = y;
    words.forEach((word) => {
      const next = line ? `${line} ${word}` : word;
      if (ctx.measureText(next).width > maxWidth && line) {
        ctx.fillText(line, x, lineY);
        line = word;
        lineY += lineHeight;
      } else {
        line = next;
      }
    });
    if (line) ctx.fillText(line, x, lineY);
  }

  function drawCandy(x, y, r, color) {
    ctx.save();
    ctx.translate(x, y);
    ctx.fillStyle = "rgba(255,255,255,0.14)";
    ctx.beginPath();
    ctx.moveTo(-r - 14, 0);
    ctx.lineTo(-r - 3, -8);
    ctx.lineTo(-r - 3, 8);
    ctx.closePath();
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(r + 14, 0);
    ctx.lineTo(r + 3, -8);
    ctx.lineTo(r + 3, 8);
    ctx.closePath();
    ctx.fill();
    drawCircle(0, 0, r, color);
    ctx.strokeStyle = "rgba(255,255,255,0.38)";
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(0, 0, r * 0.55, -0.8, 2.2);
    ctx.stroke();
    ctx.restore();
  }

  function drawIngredientIcon(icon, x, y, r, color) {
    ctx.save();
    ctx.translate(x, y);
    ctx.fillStyle = color;
    ctx.strokeStyle = "rgba(255,255,255,0.54)";
    ctx.lineWidth = 2;
    if (icon === "star") drawStar(0, 0, r, color);
    else if (icon === "drop") {
      ctx.beginPath();
      ctx.moveTo(0, -r);
      ctx.bezierCurveTo(r, -2, r * 0.72, r, 0, r);
      ctx.bezierCurveTo(-r * 0.72, r, -r, -2, 0, -r);
      ctx.fill();
      ctx.stroke();
    } else if (icon === "berry") {
      drawCircle(-r * 0.35, 0, r * 0.58, color);
      drawCircle(r * 0.35, 0, r * 0.58, color);
      drawCircle(0, -r * 0.45, r * 0.48, color);
      ctx.stroke();
    } else if (icon === "nut") {
      ctx.beginPath();
      ctx.ellipse(0, 0, r * 0.78, r, 0.3, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
    } else {
      drawStar(0, 0, r, color);
    }
    ctx.restore();
  }

  function drawStar(x, y, r, color) {
    ctx.fillStyle = color;
    ctx.beginPath();
    for (let i = 0; i < 10; i++) {
      const radius = i % 2 === 0 ? r : r * 0.45;
      const angle = -Math.PI / 2 + (i * Math.PI) / 5;
      const px = x + Math.cos(angle) * radius;
      const py = y + Math.sin(angle) * radius;
      if (i === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = "rgba(255,255,255,0.5)";
    ctx.lineWidth = 2;
    ctx.stroke();
  }

  function drawAvatar(x, y, icon) {
    drawCircle(x, y, 38, "rgba(255, 228, 160, 0.15)");
    if (icon === "lion") {
      drawCircle(x, y, 23, COLORS.gold);
      drawCircle(x - 8, y - 3, 2.5, COLORS.shadow);
      drawCircle(x + 8, y - 3, 2.5, COLORS.shadow);
      drawText("W", x, y + 13, 15, COLORS.shadow, "bold", "center");
    } else if (icon === "heart") {
      drawText("♥", x, y + 14, 42, COLORS.berry, "bold", "center");
    } else if (icon === "book") {
      drawRoundRect(x - 20, y - 22, 40, 42, 7, COLORS.sky, "rgba(255,255,255,0.45)");
      ctx.strokeStyle = "rgba(32, 22, 18, 0.35)";
      ctx.beginPath();
      ctx.moveTo(x, y - 20);
      ctx.lineTo(x, y + 20);
      ctx.stroke();
    } else {
      drawCatFace(x, y, 24);
    }
  }

  function drawCatHelper(x, y, color) {
    drawCatFace(x, y, 18);
    drawCircle(x + 22, y - 7, 6, color);
  }

  function drawCatFace(x, y, r) {
    ctx.fillStyle = "#1d1716";
    ctx.beginPath();
    ctx.moveTo(x - r * 0.8, y - r * 0.4);
    ctx.lineTo(x - r * 0.55, y - r * 1.1);
    ctx.lineTo(x - r * 0.25, y - r * 0.55);
    ctx.lineTo(x + r * 0.25, y - r * 0.55);
    ctx.lineTo(x + r * 0.55, y - r * 1.1);
    ctx.lineTo(x + r * 0.8, y - r * 0.4);
    ctx.closePath();
    ctx.fill();
    drawCircle(x, y, r, "#24201e");
    drawCircle(x - r * 0.38, y - r * 0.12, 3, COLORS.gold);
    drawCircle(x + r * 0.38, y - r * 0.12, 3, COLORS.gold);
    drawText("ω", x, y + r * 0.42, r * 0.8, COLORS.muted, "bold", "center");
  }

  function drawBush(x, y, progress) {
    const fill = progress >= 3 ? COLORS.mint : "#356b45";
    drawCircle(x - 24, y + 4, 25, "#2c5b3d");
    drawCircle(x, y - 10, 32, fill);
    drawCircle(x + 26, y + 5, 24, "#2c5b3d");
    drawText(progress >= 3 ? "발견!" : "슥슥", x, y + 43, 12, COLORS.ink, "bold", "center");
  }

  function drawCauldron(x, y, color) {
    drawCircle(x, y - 56, 72, "rgba(194, 137, 255, 0.12)");
    ctx.fillStyle = "#231a1a";
    ctx.beginPath();
    ctx.ellipse(x, y, 86, 46, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = "rgba(255,255,255,0.18)";
    ctx.lineWidth = 4;
    ctx.stroke();
    ctx.fillStyle = color;
    ctx.globalAlpha = 0.85;
    ctx.beginPath();
    ctx.ellipse(x, y - 15, 66, 25, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;
    for (let i = 0; i < 9; i++) {
      const angle = (i / 9) * Math.PI * 2 + state.stir * 0.06;
      drawCircle(x + Math.cos(angle) * 42, y - 22 + Math.sin(angle) * 14, 3, "rgba(255,255,255,0.64)");
    }
  }

  function drawThief(x, y, time) {
    drawRoundRect(x - 42, y - 64, 84, 118, 28, "rgba(32, 25, 30, 0.86)", "rgba(255, 94, 92, 0.45)");
    drawCircle(x, y - 18, 24, "#222");
    drawRoundRect(x - 23, y - 25, 46, 14, 7, COLORS.danger, null);
    drawCircle(x - 9, y - 18, 2.5, COLORS.ink);
    drawCircle(x + 9, y - 18, 2.5, COLORS.ink);
    drawText("!", x, y + 26, 26, COLORS.danger, "bold", "center");
    drawText(`${Math.ceil(time)}초`, x, y + 49, 12, COLORS.gold, "bold", "center");
  }

  function drawNavIcon(icon, x, y, color) {
    ctx.save();
    ctx.strokeStyle = color;
    ctx.fillStyle = color;
    ctx.lineWidth = 2;
    if (icon === "shop") {
      drawRoundRect(x - 11, y - 5, 22, 15, 4, null, color);
      ctx.beginPath();
      ctx.moveTo(x - 13, y - 5);
      ctx.lineTo(x, y - 17);
      ctx.lineTo(x + 13, y - 5);
      ctx.stroke();
    } else if (icon === "leaf") {
      ctx.beginPath();
      ctx.ellipse(x, y - 4, 9, 15, 0.7, 0, Math.PI * 2);
      ctx.fill();
    } else if (icon === "pot") {
      drawRoundRect(x - 13, y - 8, 26, 18, 8, null, color);
      ctx.beginPath();
      ctx.moveTo(x - 8, y - 13);
      ctx.lineTo(x + 10, y - 18);
      ctx.stroke();
    } else if (icon === "talk") {
      drawRoundRect(x - 13, y - 14, 26, 18, 6, null, color);
      ctx.beginPath();
      ctx.moveTo(x - 3, y + 4);
      ctx.lineTo(x - 8, y + 10);
      ctx.stroke();
    } else {
      drawCircle(x, y - 4, 12, color);
      drawText("₩", x, y + 2, 13, "#22130c", "bold", "center");
    }
    ctx.restore();
  }

  function collectItem(item) {
    const idx = state.collectItems.indexOf(item);
    if (idx === -1) return;
    state.collectItems.splice(idx, 1);
    const gain = 1 + (Math.random() < state.upgrades.garden * 0.08 ? 1 : 0);
    state.ingredients[item.type] = (state.ingredients[item.type] || 0) + gain;
    addEffect(item.x, item.y, `+${gain} ${ingredientMeta[item.type].name}`, ingredientMeta[item.type].color);
    setMessage(`${withObjectParticle(ingredientMeta[item.type].name)} 얻었습니다.`, 1.7);
  }

  function rubBush(index, x, y) {
    state.bushRub[index] += 1;
    addEffect(x, y - 16, "슥", COLORS.mint);
    if (state.bushRub[index] >= 3) {
      const pool = ["couragePowder", "cloudSyrup", "moonNut", "memoryBerry"];
      const type = pool[Math.floor(Math.random() * pool.length)];
      state.ingredients[type] = (state.ingredients[type] || 0) + 1;
      state.bushRub[index] = 0;
      addEffect(x, y - 24, `+ ${ingredientMeta[type].name}`, ingredientMeta[type].color);
      setMessage(`수풀 속에서 ${withObjectParticle(ingredientMeta[type].name)} 찾았습니다.`, 2);
    }
  }

  function selectRecipe(recipe) {
    if (!canAffordIngredients(recipe)) {
      setMessage(`${recipe.name} 재료가 부족합니다. 정원에서 더 모으세요.`, 2.4);
      return;
    }
    state.selectedRecipe = recipe.id;
    state.stir = 0;
    setMessage(`${recipe.name} 제조를 시작합니다. 솥을 저어 주세요.`, 2);
  }

  function stirCauldron(amount) {
    const recipe = state.selectedRecipe && recipeById(state.selectedRecipe);
    if (!recipe) return;
    state.stir = Math.min(100, state.stir + amount);
    addEffect(195 + (Math.random() - 0.5) * 60, 530 + (Math.random() - 0.5) * 34, "반짝", recipe.color);
    if (state.stir >= 100) {
      spendIngredients(recipe);
      state.inventory[recipe.id] += 1;
      state.selectedRecipe = null;
      state.stir = 0;
      state.mode = "serve";
      setMessage(`${recipe.name} 완성. 이제 손님에게 포장해 주세요.`, 3);
    }
  }

  function selectSnack(recipe) {
    if ((state.inventory[recipe.id] || 0) <= 0) {
      setMessage(`${recipe.name} 재고가 없습니다. 먼저 제조하세요.`, 2);
      return;
    }
    state.selectedSnack = recipe.id;
    setMessage(`${recipe.name}을 골랐습니다.`, 1.6);
  }

  function sellSnack() {
    const customer = currentCustomer();
    const recipe = state.selectedSnack && recipeById(state.selectedSnack);
    if (!recipe || !state.selectedSticker) {
      setMessage("과자와 주의사항 스티커를 모두 골라야 합니다.", 2);
      return;
    }
    state.inventory[recipe.id] -= 1;
    const correct = recipe.need === customer.id || (customer.id === "cat" && recipe.id === "brave");
    const safe = state.selectedSticker === recipe.caution;
    if (correct && safe) {
      const bonus = (state.upgrades.shelf - 1) * 2;
      const reward = customer.reward + bonus;
      state.coins += reward;
      state.reputation = Math.min(state.maxReputation, state.reputation + (Math.random() < state.upgrades.cat * 0.18 ? 1 : 0));
      state.sales += 1;
      state.codex.push({ title: `${customer.name}의 후기`, text: customer.story });
      addEffect(196, 612, `+${reward} 행운 동전`, COLORS.gold);
      setMessage("정확한 과자와 주의사항입니다. 손님이 웃으며 돌아갔어요.", 3.2);
      nextCustomer();
      triggerThiefMission();
    } else {
      state.reputation = Math.max(0, state.reputation - 1);
      state.screenShake = 7;
      const why = !correct ? "고민과 맞지 않는 과자였습니다." : "주의사항 스티커가 틀렸습니다.";
      setMessage(`${why} 평판이 떨어졌어요.`, 3);
    }
  }

  function buyUpgrade(upgrade) {
    if (state.coins < upgrade.cost) {
      setMessage("행운 동전이 부족합니다.", 1.8);
      return;
    }
    state.coins -= upgrade.cost;
    state.upgrades[upgrade.id] += 1;
    setMessage(`${upgrade.name} Lv.${state.upgrades[upgrade.id]} 달성.`, 2.2);
  }

  function chaseThief() {
    if (!state.mission) return;
    state.coins += 8;
    state.mission = null;
    addEffect(280, 260, "+8 경계 보상", COLORS.gold);
    setMessage("수상한 손님을 쫓아냈습니다. 불량 과자는 무사합니다.", 3);
  }

  function handlePointerDown(e) {
    const p = eventToCanvas(e);
    pointer = { down: true, x: p.x, y: p.y, lastX: p.x, lastY: p.y };
    const area = [...hitAreas].reverse().find((hit) => p.x >= hit.x && p.x <= hit.x + hit.w && p.y >= hit.y && p.y <= hit.y + hit.h);
    if (area) {
      area.callback();
      render();
    }
  }

  function handlePointerMove(e) {
    if (!pointer.down) return;
    const p = eventToCanvas(e);
    if (state.mode === "cook" && state.selectedRecipe && p.x >= 74 && p.x <= 316 && p.y >= 468 && p.y <= 658) {
      const dist = Math.hypot(p.x - pointer.lastX, p.y - pointer.lastY);
      if (dist > 8) stirCauldron(dist * 0.11);
    }
    if (state.mode === "garden") {
      [0, 1, 2].forEach((i) => {
        const bx = 76 + i * 112;
        const by = 632;
        if (Math.abs(p.x - bx) < 48 && Math.abs(p.y - by) < 45) {
          if (Math.hypot(p.x - pointer.lastX, p.y - pointer.lastY) > 12) rubBush(i, bx, by);
        }
      });
    }
    pointer.lastX = p.x;
    pointer.lastY = p.y;
    pointer.x = p.x;
    pointer.y = p.y;
  }

  function handlePointerUp() {
    pointer.down = false;
  }

  function eventToCanvas(e) {
    const rect = canvas.getBoundingClientRect();
    const clientX = e.touches?.[0]?.clientX ?? e.clientX;
    const clientY = e.touches?.[0]?.clientY ?? e.clientY;
    return {
      x: ((clientX - rect.left) / rect.width) * W,
      y: ((clientY - rect.top) / rect.height) * H,
    };
  }

  function loop(now) {
    const dt = Math.min(0.05, (now - lastTime) / 1000);
    lastTime = now;
    update(dt);
    render();
    requestAnimationFrame(loop);
  }

  function renderGameToText() {
    const visibleAreas = hitAreas
      .filter((area) => area.label)
      .slice(-18)
      .map((area) => ({ label: area.label, x: Math.round(area.x), y: Math.round(area.y), w: Math.round(area.w), h: Math.round(area.h) }));
    const payload = {
      coordinateSystem: "origin top-left, x right, y down, canvas 390x844",
      mode: state.mode,
      stats: {
        day: state.day,
        coins: state.coins,
        reputation: state.reputation,
        sales: state.sales,
      },
      currentCustomer: {
        id: currentCustomer().id,
        name: currentCustomer().name,
        worry: currentCustomer().worry,
      },
      ingredients: { ...state.ingredients },
      inventory: { ...state.inventory },
      selected: {
        recipe: state.selectedRecipe,
        snack: state.selectedSnack,
        sticker: state.selectedSticker,
        stir: Math.round(state.stir),
      },
      mission: state.mission ? { type: state.mission.type, time: Math.round(state.mission.time * 10) / 10, x: Math.round(state.mission.x), y: Math.round(state.mission.y) } : null,
      collectItems: state.collectItems.map((item) => ({ type: item.type, x: Math.round(item.x), y: Math.round(item.y) })),
      activeHitAreas: visibleAreas,
      message: state.message,
    };
    return JSON.stringify(payload);
  }

  window.render_game_to_text = renderGameToText;
  window.advanceTime = (ms) => {
    const steps = Math.max(1, Math.round(ms / (1000 / 60)));
    for (let i = 0; i < steps; i++) update(1 / 60);
    render();
  };

  window.addEventListener("keydown", (e) => {
    if (e.key.toLowerCase() === "f") {
      if (!document.fullscreenElement) canvas.requestFullscreen?.();
      else document.exitFullscreen?.();
    }
  });

  canvas.addEventListener("pointerdown", handlePointerDown);
  canvas.addEventListener("pointermove", handlePointerMove);
  window.addEventListener("pointerup", handlePointerUp);
  canvas.addEventListener("touchstart", (e) => e.preventDefault(), { passive: false });
  canvas.addEventListener("touchmove", (e) => e.preventDefault(), { passive: false });

  setupCanvasScale();
  spawnIngredient();
  render();
  requestAnimationFrame(loop);
})();
