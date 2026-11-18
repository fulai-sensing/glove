"""Rebuild Chinese overview illustrations with Pillow and Microsoft YaHei.

Run from any directory: python docs/scripts/localize-overview-images.py
Only text areas are replaced; the source glove, callouts and arrows are retained.
"""
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont


IMAGES = Path(__file__).resolve().parents[1] / "img"
FONTS = Path("C:/Windows/Fonts")


def label(image, bounds, text, size, *, bold=False, color="#000000", background="white"):
    draw = ImageDraw.Draw(image)
    draw.rectangle(bounds, fill=background)
    font = ImageFont.truetype(str(FONTS / ("msyhbd.ttc" if bold else "msyh.ttc")), size)
    left, top, right, bottom = bounds
    box = draw.multiline_textbbox((0, 0), text, font=font, spacing=10, align="center")
    width, height = box[2] - box[0], box[3] - box[1]
    assert width <= right - left and height <= bottom - top, text
    draw.multiline_text(
        ((left + right - width) / 2 - box[0], (top + bottom - height) / 2 - box[1]),
        text, font=font, spacing=10, align="center", fill=color,
    )


regions = Image.open(IMAGES / "capacitive-rid11.webp").convert("RGB")
for bounds, text in [
    ((320, 0, 600, 51), "中指"),
    ((76, 91, 320, 138), "食指"),
    ((578, 79, 807, 126), "无名指"),
    ((674, 221, 914, 270), "小指"),
    ((0, 386, 150, 433), "拇指"),
    ((721, 556, 912, 665), "掌心"),
    ((687, 758, 914, 864), "小鱼际"),
]:
    label(regions, bounds, text, 42)
regions.save(IMAGES / "sensing-regions-zh.webp", lossless=True)


for model, rate, offset in [("capacitive", 240, 0), ("piezoresistive", 100, 6)]:
    diagram = Image.open(IMAGES / f"{model}-rid12.webp").convert("RGB")
    fill = diagram.getpixel((200 + offset, 175))

    def box(bounds, text, size=25, bold=False):
        left, top, right, bottom = bounds
        label(diagram, (left + offset, top, right + offset, bottom), text, size,
              bold=bold, color="#1c2023" if bold else "#7b7f8b", background=fill)

    box((25, 188, 345, 238), "触觉手套", 32, True)
    box((25, 242, 345, 315), "柔性触觉传感器阵列\n每只手套 7 个感知区域")
    label(diagram, (380 + offset, 195, 474 + offset, 233), "线缆", 25, color="#7b7f8b")
    box((508, 188, 828, 238), "触觉控制器", 32, True)
    box((508, 242, 828, 315), f"12 位采样\n数据速率：{rate} Hz")
    box((989, 162, 1361, 237), "数据采集软件", 32, True)
    box((989, 242, 1361, 333), "实时热力图 · 分区力曲线\n录制与回放")
    box((1548, 53, 1834, 104), "CSV 导出", 32, True)
    box((1548, 337, 1834, 412), "TCP 实时输出", 32, True)
    box((1548, 417, 1834, 456), "JSON 行格式")
    label(diagram, (90, 519, diagram.width - 90, 557),
          "系统总功耗 < 1 W    ·    最长录制时间：60 分钟    ·    支持单手或双手同步采集",
          26, bold=True, color="#1c2023")
    diagram.save(IMAGES / f"{model}-workflow-zh.webp", lossless=True)
