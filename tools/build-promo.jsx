(function () {
    app.beginSuppressDialogs();
    try {
    var base = "D:/deep seek harness/st-mirage-phone/";
    var proj = app.newProject();
    var comp = proj.items.addComp("MiragePhone_Promo", 1080, 1920, 1, 12.7, 30);
    comp.bgColor = [0.03, 0.02, 0.06];
    comp.motionBlur = false;

    function img(name) {
        return proj.importFile(new ImportOptions(new File(base + "shots/" + name)));
    }
    function fade(layer, start, end, fin, fout) {
        layer.inPoint = start;
        layer.outPoint = end;
        var op = layer.property("Opacity");
        op.setValueAtTime(start, 0);
        op.setValueAtTime(start + fin, 100);
        op.setValueAtTime(end - fout, 100);
        op.setValueAtTime(end, 0);
    }
    function text(str, size, color, x, y, bold, track) {
        var layer = comp.layers.addText(str);
        var td = layer.property("Source Text").value;
        try { td.font = "Microsoft YaHei"; } catch (fontErr) { try { td.font = "MicrosoftYaHei"; } catch (fontErr2) {} }
        td.fontSize = size;
        td.applyFill = true;
        td.fillColor = color;
        td.justification = ParagraphJustification.CENTER_JUSTIFY;
        td.applyStroke = false;
        if (bold) td.fauxBold = true;
        if (track) td.tracking = track;
        layer.property("Source Text").setValue(td);
        layer.position.setValue([x, y]);
        return layer;
    }

    var bg = comp.layers.add(img("promo-bg.png"));
    bg.scale.setValue([100, 100]);
    bg.position.setValue([540, 960]);
    bg.inPoint = 0;
    bg.outPoint = 12.7;

    // 手机画面
    var screens = [
        { file: "p-home.png", start: 1.7, end: 4.2, caption: "桌面 · 拖动 / 分组 / 悬浮窗" },
        { file: "m2-chat.png", start: 3.9, end: 6.4, caption: "和世界里的人聊天" },
        { file: "p-ig.png", start: 6.1, end: 8.6, caption: "刷得到的世界" },
        { file: "p-map.png", start: 8.3, end: 10.8, caption: "地图 · 从一个地方出发" }
    ];
    for (var i = 0; i < screens.length; i++) {
        var s = screens[i];
        var layer = comp.layers.add(img(s.file));
        layer.inPoint = s.start;
        layer.outPoint = s.end;
        layer.property("Position").setValue([540, 960]);
        layer.property("Scale").setValueAtTime(s.start, [216, 216]);
        layer.property("Scale").setValueAtTime(s.end, [223, 223]);
        var op = layer.property("Opacity");
        op.setValueAtTime(s.start, 0);
        op.setValueAtTime(s.start + 0.3, 100);
        op.setValueAtTime(s.end - 0.3, 100);
        op.setValueAtTime(s.end, 0);

        var cap = text(s.caption, 38, [1, 1, 1], 540, 1630, true, 40);
        fade(cap, s.start + 0.15, s.end - 0.15, 0.25, 0.25);
    }

    // 开场
    var kicker = text("M I R A G E   P H O N E", 26, [1, 0.55, 0.72], 540, 690, true, 180);
    fade(kicker, 0.15, 2.1, 0.4, 0.25);
    var title = text("幻镜手机", 150, [1, 1, 1], 540, 870, true, 20);
    fade(title, 0.05, 2.1, 0.5, 0.3);
    try {
        var glow = title.Effects.addProperty("ADBE Glo2");
        glow.property("Glow Radius").setValue(28);
        glow.property("Glow Intensity").setValue(1.4);
    } catch (e) {}
    var sub = text("给 SillyTavern 的一部手机", 40, [0.92, 0.9, 0.96], 540, 1035, false, 20);
    fade(sub, 0.45, 2.1, 0.4, 0.25);
    var line = comp.layers.addSolid([1, 0.35, 0.55], "accent", 210, 3, 1);
    line.position.setValue([540, 1135]);
    fade(line, 0.6, 2.1, 0.35, 0.25);

    // 结尾
    var endTitle = text("把故事装进口袋", 92, [1, 1, 1], 540, 860, true, 10);
    fade(endTitle, 10.2, 12.7, 0.4, 0.3);
    var url = text("github.com/jbozhang61-byte/st-mirage-phone", 28, [1, 0.7, 0.82], 540, 985, false, 10);
    fade(url, 10.45, 12.7, 0.35, 0.25);
    var endSub = text("SillyTavern 扩展 · 免费开源", 34, [0.9, 0.88, 0.94], 540, 1050, false, 20);
    fade(endSub, 10.6, 12.7, 0.35, 0.25);

    proj.save(new File(base + "docs/promo-ae.aep"));
    app.endSuppressDialogs(false);
    } catch (err) {
        var ef = new File("D:/deep seek harness/st-mirage-phone/docs/promo-ae-error.txt");
        ef.open("w");
        ef.write(err.toString() + " / line " + err.line);
        ef.close();
    }
})();