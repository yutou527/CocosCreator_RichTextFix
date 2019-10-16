

const { ccclass, property } = cc._decorator;
declare const require;
const HtmlTextParser = require('./html-text-parser');
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
    underline?: boolean
}

@ccclass
export default class RichText extends cc.Component {

    @property
    string: string = 'test';
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
        let textData = _htmlTextParser.parse(this.string);
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
            this.addItem(node);
        })
        // cc.log(this)
        this.scheduleOnce(_ => {
            this.relayout();
            this.resizeHeight();
        })

    }

    dealData(data: TextData): cc.Node {
        if (data.style.isImage) {
            return this.makeSprite(data);
        } else {
            return this.makeLabel(data);
        }
    }
    makeLabel(textData: TextData): cc.Node {
        let label = new cc.Node().addComponent(cc.Label);
        label.string = textData.text;
        label.fontSize = this.fontSize;
        label.lineHeight = this.lineHeight;

        if (!textData.style.color) {
            label.node.color = this.node.color;
        } else {
            label.node.color = new cc.Color().fromHEX(textData.style.color)
        }
        //@ts-ignore
        label._enableUnderline(textData.style.underline);
        if (textData.style.event) {
            //添加事件
            label.node.on(cc.Node.EventType.TOUCH_END, e => {
                if (!this.eventComponentName) {
                    cc.warn('未指定事件响应的component')
                    return;
                }
                let eCmp = this.getComponent(this.eventComponentName);
                if (eCmp && eCmp[textData.style.event.click]) {
                    eCmp[textData.style.event.click].call(eCmp, textData.text);
                } else {
                    cc.warn('cant find component ' + this.eventComponentName + ' for event ' + textData.style.event.click)
                }
            })
        }
        //计算width
        // label.node.width = this.fontSize * textData.text.length;
        return label.node;
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
    addItem(node: cc.Node) {
        node.opacity = 0;
        this.node.addChild(node);
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
                    // if (this._textData[i].style.isImage) {
                    //     this._nowLine += 1;
                    //     //图片 直接换
                    //     x = 0;
                    //     y = this._nowLine * this.lineHeight;
                    // } else { 
                    //     //分割label

                    // }
                } else {

                }

                x = this._nowX + c.width / 2;
                y = this._nowLine * this.lineHeight;
                this._nowX += c.width;

                if (this._nowLine == 1) {
                    this.node.width += c.width;
                }
                if (this._textData[i].style.isImage) {
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
                if (this._textData[i].style.isImage) {
                    if (c.height > this.lineHeight) {
                        let fix = c.height - this.lineHeight;
                        if (fix > this._heightFix)
                            this._heightFix = fix;
                    }
                }
            }


            c.x = x;
            c.y = -y;
            c.opacity = 255;
        })
    }
    resizeHeight() {
        this.node.height = this._nowLine * this.lineHeight + (this._mutilLineFix || this._heightFix);
    }
    //换行情况需要打断label

    // update (dt) {}
}
