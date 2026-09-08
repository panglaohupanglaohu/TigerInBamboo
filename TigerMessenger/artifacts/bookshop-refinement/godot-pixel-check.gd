extends SceneTree
## Compare the two frozen captures from the actual main-scene ink test.
func _initialize() -> void:
	var folder := ProjectSettings.globalize_path("res://../artifacts/bookshop-refinement/")
	var off := Image.load_from_file(folder + "godot-ink-off.png")
	var on := Image.load_from_file(folder + "godot-ink-on.png")
	assert(off.get_size() == on.get_size())
	var changed := 0
	var first := Vector2i(off.get_width(), off.get_height())
	var last := Vector2i.ZERO
	for y in range(off.get_height()):
		for x in range(off.get_width()):
			var a := off.get_pixel(x, y)
			var b := on.get_pixel(x, y)
			if maxf(absf(a.r - b.r), maxf(absf(a.g - b.g), absf(a.b - b.b))) < 1.0 / 255: continue
			changed += 1
			first = first.min(Vector2i(x, y))
			last = last.max(Vector2i(x, y))
	var fraction := float(changed) / (off.get_width() * off.get_height())
	# An opaque duplicate facade would alter a broad area, not thin strokes.
	var passed := changed > 50 and fraction < .02
	var report := {"changed_pixels": changed, "changed_fraction": fraction, "changed_bounds": [str(first), str(last)], "passed": passed, "limitation": "Area check supplements visual inspection; it is not a full style-parity proof."}
	var file := FileAccess.open(folder + "godot-pixels.json", FileAccess.WRITE)
	file.store_string(JSON.stringify(report, "  "))
	print("BOOKSHOP_INK_PIXELS ", JSON.stringify(report))
	quit(0 if passed else 1)
