
declare const utils;
declare const require;
const { ccclass, property } = cc._decorator;
const HtmlTextParser = require('html-text-parser');
const _htmlTextParser = new HtmlTextParser();
interface TextData {
    text: string;
    style: RichStyle;
}
interface RichStyle {
    isImage?: boolean;
    src?: string;
    color?: string;
    event?: { click: string };
    underline?: boolean;
    newline?: boolean;//换行
}

@ccclass
export default class RichText extends cc.Component {

    @property
    string: string = '';
    @property
    maxWidth: number = 0;
    @property
    fontSize: number = 20;
    @property
    lineHeight: number = 22;

    @property
    eventComponentName: string = '';
    @property(cc.SpriteAtlas)
    atlas: cc.SpriteAtlas = null;
    // LIFE-CYCLE CALLBACKS:

    private sfs: [{ index: string }, cc.SpriteFrame];

    //辅助排版
    private _nowX = 0;
    private _nowLine = 1;
    private _textData: TextData[] = []
    private _heightFix = 0; // 高度修正 有图片高度可能超过lineheight 
    private _mutilLineFix = 0;
    // onLoad () {}

    start() {
        this.node.anchorY = 1;
        let textData = _htmlTextParser.parse(this.string) as [TextData];
        this._textData = textData;
        // cc.log(textData);
        this.sfs = {} as [{ index: string }, cc.SpriteFrame];
        if (this.atlas) {
            this.atlas.getSpriteFrames().forEach(sf => {
                this.sfs[sf.name] = sf;
            })
        }
        textData.forEach(d => {
            let node = this.dealData(d);
            // this.addItem(node);
            node.forEach(n => {
                this.addItemWithLayout(n, d.style)
            })
        })
        // cc.log(this)
        // this.scheduleOnce(_ => {
        // this.relayout();
        this.resizeHeight();
        // })
        // this.node.on(cc.Node.EventType.TOUCH_END, e => {
        //     this.debug();
        //     cc.log(this)
        // })
    }

    dealData(data: TextData): Array<cc.Node> {
        if (data.style && data.style.isImage) {
            return [this.makeSprite(data)];
        } else {
            return this.makeLabel(data);
        }
    }
    makeLabel(textData: TextData): Array<cc.Node> {
        let label = new cc.Node().addComponent(cc.Label);
        let style = textData.style || {};
        label.string = textData.text;
        label.fontSize = this.fontSize;
        label.lineHeight = this.fontSize + 2;

        if (!style.color) {
            label.node.color = this.node.color;
        } else {
            label.node.color = new cc.Color().fromHEX(style.color)
        }
        //@ts-ignore
        label._enableUnderline(style.underline);
        if (style.event) {
            //添加事件
            label.node.on(cc.Node.EventType.TOUCH_END, e => {
                if (!this.eventComponentName) {
                    cc.warn('未指定事件响应的component')
                    return;
                }
                let eCmp = this.getComponent(this.eventComponentName);
                if (eCmp && eCmp[style.event.click]) {
                    eCmp[style.event.click].call(eCmp);
                } else {
                    cc.warn('cant find component ' + this.eventComponentName + ' for event ' + style.event.click)
                }
            })
        }
        //计算width
        //@ts-ignore
        label._updateRenderData(true)
        // return [label.node];
        return this._splitLabel(label.node, textData);
    }
    _splitLabel(node: cc.Node, data: TextData): Array<cc.Node> {
        let labels: Array<cc.Node> = [];
        if (this.maxWidth > 0) {
            let overWidth = (this._nowX + node.width) - this.maxWidth;
            if (overWidth > 0) {
                let _strLength = data.text.length;
                let _overStrs = Math.ceil(_strLength * (overWidth / this.maxWidth));
                let str = data.text.slice(0, _strLength - _overStrs);
                let nextStr = data.text.slice(_strLength - _overStrs, data.text.length);
                labels.push(...this.makeLabel({
                    text: str,
                    style: data.style
                }))
                labels.push(...this.makeLabel({
                    text: nextStr,
                    style: data.style
                }))
            } else {
                labels.push(node)
            }
        }

        return labels;
    }
    makeSprite(textData: TextData): cc.Node {
        let sprite = new cc.Node().addComponent(cc.Sprite);
        let sf = this.sfs[textData.style.src] as cc.SpriteFrame;
        sprite.spriteFrame = sf;
        let size = sf.getOriginalSize();
        sprite.node.width = size.width;
        sprite.node.height = size.height
        sprite.sizeMode = cc.Sprite.SizeMode.RAW;
        sprite.trim = false;
        return sprite.node;
    }
    addItemWithLayout(node: cc.Node, style: RichStyle) {
        let pos = this._getLastPos();
        if (this.maxWidth > 0 && this._nowX + node.width > this.maxWidth || (style && style.newline)) {
            this._nextLine();
        }

        pos.x = this._nowX + node.width / 2;
        pos.y = -this._nowLine * this.lineHeight + this.lineHeight / 2;
        this._nowX += node.width;



        node.position = pos;
        this.node.addChild(node);
    }

    addItem(node: cc.Node) {
        node.opacity = 0;
        this.node.addChild(node);
    }
    _nextLine() {
        this._nowX = 0;
        this._nowLine += 1;
    }

    //重新排版
    //TODO:分割label
    relayout() {
        this._nowX = 0;

        this.node.children.forEach((c, i) => {
            let x, y = 0;
            //处理换行
            if (this.maxWidth > 0) {

                if (this._nowX + c.width > this.maxWidth) {
                    //需要换行
                    this._nowLine += 1;
                    //直接换
                    this._nowX = 0;
                    this._mutilLineFix += this._heightFix;
                    this._heightFix = 0

                } else {

                }

                x = this._nowX + c.width / 2;
                y = this._nowLine * this.lineHeight;
                this._nowX += c.width;

                if (this._nowLine == 1) { //根据第一行决定width
                    this.node.width += c.width;
                }
                let style = this._textData[i].style || {};
                if (style.isImage) {
                    if (c.height > this.lineHeight) {
                        let fix = c.height - this.lineHeight;
                        if (fix > this._heightFix)
                            this._heightFix = fix;
                    }
                }
            } else {
                x = this._nowX + c.width / 2;
                this._nowX += c.width;
                this.node.width += c.width;
                //fix height
                let style = this._textData[i].style || {};
                if (style.isImage) {
                    if (c.height > this.lineHeight) {
                        let fix = c.height - this.lineHeight;
                        if (fix > this._heightFix)
                            this._heightFix = fix;
                    }
                }
            }


            c.x = x;
            c.y = - y + this.lineHeight / 2;
            c.opacity = 255;
        })
    }
    resizeHeight() {
        this.node.height = this._nowLine * this.lineHeight //+ (this._mutilLineFix || this._heightFix);
    }
    _getLastPos(): cc.Vec2 {
        let pos = new cc.Vec2();
        let lastNode = this.node.children[this.node.children.length - 1]
        if (lastNode)
            pos = lastNode.position;
        return pos;
    }
    debug() {
        let graphic = this.node.addComponent(cc.Graphics);
        graphic.strokeColor = utils.getUIColor('green');
        graphic.lineWidth = 2;
        graphic.moveTo(0, 0);
        graphic.circle(0, 0, 3);
        graphic.lineTo(this.node.width, 0)
        graphic.circle(this.node.width, 0, 3)

        graphic.lineTo(this.node.width, -this.node.height);
        graphic.circle(this.node.width, -this.node.height, 3);


        graphic.lineTo(0, -this.node.height);
        graphic.circle(0, -this.node.height, 3);

        graphic.lineTo(0, 0);

        graphic.stroke();
    }

    //换行情况需要打断label

    // update (dt) {}
}
