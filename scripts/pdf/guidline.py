import fitz  # PyMuPDF

input_pdf = "tournament.pdf"
output_pdf = "output_with_grid.pdf"
grid_interval = 25  # pt

doc = fitz.open(input_pdf)

for page in doc:
    page_width = page.rect.width
    page_height = page.rect.height

    # 縦線
    x = 0
    while x <= page_width:
        stroke_width = 0.5
        if x % 100 == 0:
            stroke_width = 2

        page.draw_line((x, 0), (x, page_height), color=(0.8, 0.8, 0.8), width=stroke_width)
        page.insert_text((x + 2, 10), str(int(x)), fontsize=6)
        x += grid_interval

doc.save(output_pdf)
doc.close()

