module BABYLON {

    @className("LayoutEngineBase")
    /**
     * This is the base class you have to extend in order to implement your own Layout Engine.
     * Note that for performance reason, each different Layout Engine type can be exposed as one/many singleton or must be instanced each time.
     * If data has to be associated to a given primitive you can use the SmartPropertyPrim.addExternalData API to do it.
     */
    export class LayoutEngineBase implements ILockable {
        constructor() {
            this.layoutDirtyOnPropertyChangedMask = 0;
        }

        public updateLayout(prim: Prim2DBase) {
        }

        public get isChildPositionAllowed(): boolean {
            return false;
        }

        isLocked(): boolean {
            return this._isLocked;
        }

        lock(): boolean {
            if (this._isLocked) {
                return false;
            }
            this._isLocked = true;
            return true;
        }

        public layoutDirtyOnPropertyChangedMask;

        private _isLocked: boolean;
    }

    @className("CanvasLayoutEngine")
    /**
     * The default Layout Engine, primitive are positioning into a Canvas, using their x/y coordinates.
     * This layout must be used as a Singleton through the CanvasLayoutEngine.Singleton property.
     */
    export class CanvasLayoutEngine extends LayoutEngineBase {
        public static Singleton: CanvasLayoutEngine = new CanvasLayoutEngine();

        // A very simple (no) layout computing...
        // The Canvas and its direct children gets the Canvas' size as Layout Area
        // Indirect children have their Layout Area to the actualSize (margin area) of their parent
        public updateLayout(prim: Prim2DBase) {

            // If this prim is layoutDiry we update  its layoutArea and also the one of its direct children
            if (prim._isFlagSet(SmartPropertyPrim.flagLayoutDirty)) {

                for (let child of prim.children) {
                    this._doUpdate(child);
                }
                prim._clearFlags(SmartPropertyPrim.flagLayoutDirty);
            }

        }

        private _doUpdate(prim: Prim2DBase) {
            // Canvas ?
            if (prim instanceof Canvas2D) {
                prim.layoutArea = prim.actualSize;
            }

            // Direct child of Canvas ?
            else if (prim.parent instanceof Canvas2D) {
                prim.layoutArea = prim.owner.actualSize;
            }

            // Indirect child of Canvas
            else {
                prim.layoutArea = prim.parent.contentArea;
            }
        }

        get isChildPositionAllowed(): boolean {
            return true;
        }
    }


    @className("StackPanelLayoutEngine")
    /**
     * A stack panel layout. Primitive will be stack either horizontally or vertically.
     * This Layout type must be used as a Singleton, use the StackPanelLayoutEngine.Horizontal for an horizontal stack panel or StackPanelLayoutEngine.Vertical for a vertical one.
     */
    export class StackPanelLayoutEngine extends LayoutEngineBase {
        constructor() {
            super();
            this.layoutDirtyOnPropertyChangedMask = Prim2DBase.sizeProperty.flagId;
        }

        public static get Horizontal(): StackPanelLayoutEngine {
            if (!StackPanelLayoutEngine._horizontal) {
                StackPanelLayoutEngine._horizontal = new StackPanelLayoutEngine();
                StackPanelLayoutEngine._horizontal.isHorizontal = true;
                StackPanelLayoutEngine._horizontal.lock();
            }

            return StackPanelLayoutEngine._horizontal;
        }

        public static get Vertical(): StackPanelLayoutEngine {
            if (!StackPanelLayoutEngine._vertical) {
                StackPanelLayoutEngine._vertical = new StackPanelLayoutEngine();
                StackPanelLayoutEngine._vertical.isHorizontal = false;
                StackPanelLayoutEngine._vertical.lock();
            }

            return StackPanelLayoutEngine._vertical;
        }
        private static _horizontal: StackPanelLayoutEngine = null;
        private static _vertical: StackPanelLayoutEngine = null;


        get isHorizontal(): boolean {
            return this._isHorizontal;
        }

        set isHorizontal(val: boolean) {
            if (this.isLocked()) {
                return;
            }
            this._isHorizontal = val;
        }

        private _isHorizontal: boolean = true;

        public updateLayout(prim: Prim2DBase) {
            if (prim._isFlagSet(SmartPropertyPrim.flagLayoutDirty)) {

                let x = 0;
                let y = 0;
                let h = this.isHorizontal;
                let max = 0;

                for (let child of prim.children) {
                    let layoutArea = child.layoutArea;
                    child.margin.computeArea(child.actualSize, layoutArea);

                    max = Math.max(max, h ? layoutArea.height : layoutArea.width);

                }

                for (let child of prim.children) {
                    child.layoutAreaPos = new Vector2(x, y);

                    let layoutArea = child.layoutArea;

                    if (h) {
                        x += layoutArea.width;
                        child.layoutArea = new Size(layoutArea.width, max);
                    } else {
                        y += layoutArea.height;
                        child.layoutArea = new Size(max, layoutArea.height);
                    }
                }
                prim._clearFlags(SmartPropertyPrim.flagLayoutDirty);
            }

        }

        get isChildPositionAllowed(): boolean {
            return false;
        }
    }

    class GridDimensionDefinition {

        public static Pixels = 1;
        public static Stars = 2;
        public static Auto = 3;

        _parse(value: string, res: (v: number, vp: number, t: number) => void) {
            let v = value.toLocaleLowerCase().trim();
            if (v.indexOf("auto") === 0) {
                res(null, null, GridDimensionDefinition.Auto);
            } else if (v.indexOf("*") !== -1) {
                let i = v.indexOf("*");
                let w = parseFloat(v.substr(0, i));
                res(w, null, GridDimensionDefinition.Stars);
            } else {
                let w = parseFloat(v);
                res(w, w, GridDimensionDefinition.Pixels);
            }
        }
    }

    class RowDefinition extends GridDimensionDefinition {
        widthPixels: number;
        width: number;
        widthType: number;

    }

    class ColumnDefinition extends GridDimensionDefinition {
        heightPixels: number;
        height: number;
        heightType: number;
    }

    export class PrimitiveGridInfo {
        constructor(row: number, column: number, rowSpan?: number, columnSpan?: number) {
            this.row = row;
            this.column = column;
            this.rowSpan = (rowSpan == null) ? 1 : rowSpan;
            this.columnSpan = (columnSpan == null) ? 1 : columnSpan;
        }
        row: number;
        column: number;
        rowSpan: number;
        columnSpan: number;
    }

    class CellInfo {

    }

    @className("GridPanelLayoutEngine")
    export class GridPanelLayoutEngine extends LayoutEngineBase {
        constructor(settings: { rows: [{ height: string }], columns: [{ width: string }] }) {
            super();
            this.layoutDirtyOnPropertyChangedMask = Prim2DBase.sizeProperty.flagId;

            this._cells = null;
            this._rows = new Array<RowDefinition>();
            this._columns = new Array<ColumnDefinition>();

            if (settings.rows) {
                for (let row of settings.rows) {
                    let r = new RowDefinition();
                    r._parse(row.height, (v, vp, t) => {
                        r.width = v;
                        r.widthPixels = vp;
                        r.widthType = t;
                    });
                    this._rows.push(r);
                }
            }
            if (settings.columns) {
                for (let col of settings.columns) {
                    let r = new ColumnDefinition();
                    r._parse(col.width, (v, vp, t) => {
                        r.height = v;
                        r.heightPixels = vp;
                        r.heightType = t;
                    });
                    this._columns.push(r);
                }
            }
        }

        private _rows: Array<RowDefinition>;
        private _columns: Array<ColumnDefinition>;

        private _cells: CellInfo[][];

        public updateLayout(prim: Prim2DBase) {
            if (prim._isFlagSet(SmartPropertyPrim.flagLayoutDirty)) {

                this._updateCellsList(prim);
                this._updateConstants(prim);


                prim._clearFlags(SmartPropertyPrim.flagLayoutDirty);
            }

        }

        get isChildPositionAllowed(): boolean {
            return false;
        }

        private _updateCellsList(prim: Prim2DBase) {
            if (this._cells) {
                return;
            }

            this._cells = [];

            let rl = this._rows.length;
            for (let i = 0; i < rl; i++) {
                this._cells[i] = [];

                let cl = this._columns.length;
                for (let j = 0; j < cl; j++) {
                    let cell = new CellInfo();
                    this._cells[i][j] = cell;
                }
            }

            for (let child of prim.children) {
                let pgi = child.getExternalData<PrimitiveGridInfo>("grid");
                let cell = this._cells[pgi.row][pgi.column];
            }

        }

        private _updateConstants(prim: Prim2DBase) {
            let area = prim.contentArea;

            // First path, stars/pixel total count
            let totalStars = 0;
            let totalPixels = 0;
            for (let row of this._rows) {
                if (row.widthType === GridDimensionDefinition.Stars) {
                    totalStars += row.width;
                } else if (row.widthType === GridDimensionDefinition.Pixels) {
                    totalPixels += row.widthPixels;
                } else if (row.widthType === GridDimensionDefinition.Auto) {
                    totalPixels += row.widthPixels;
                }
            }



        }
    }
}