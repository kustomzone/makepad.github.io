module.exports = require('view').extend(function EditView(proto){
	var painter = require('painter')
	proto.props = {
		cursorTrim:0.
	}

	//
	//
	// Shaders
	//
	//

	proto.tools = {
		Bg:require('shaders/fastrectshader').extend({
			borderRadius:0,
			padding:2,
			color:'#0c2141'
		}),
		Debug:require('shaders/rectshader').extend({
			color:[0,0,0,0],
			borderRadius:1,
			borderWidth:1,
			borderColor:'red'
		}),
		Text:require('shaders/sdffontshader').extend({
			font:require('fonts/ubuntu_medium_256.sdffont'),
			fontSize:24,
			color:'#ccc',
			drawDiscard:'y'
		}),
		Select:require('shaders/rectshader').extend({
			color:'#458',
			//duration:0.2,
			borderWidth:1,
			borderRadius:3,
			borderColor:['#458',1.2],
			drawDiscard:'y',
			//ease:[1,100,0,0],
			//tween:2,
			vertexStyle:function(){
				var dx = 0.75
				this.x -= dx
				this.y -= dx
				this.w += 2.*dx
				this.h += 2.*dx
			}
		}),		
		Cursor:require('shaders/rectshader').extend({
			duration:0.2,
			ease:[1,100,0,0],
			tween:2,
			color:'#fff',
			vertexStyle:function(){
				var time = this.normalTween
				var v = sin(time*PI)
				this.y -= v*4.
				this.h += v*8.
				this.x -= v
				this.w += v*2.
				this.shadowOffset = vec2(-v,v)*4.
			}
		})/*,
		SelectHandle:require('stamp').extend(function SelectHandle(proto){

			proto.props = {
				text:'Button',
			}
			proto.inPlace = 1

			proto.tools = {
				Shape: require('shaders/rectshader').extend({
					color:'red'
				})
			}

			proto.states = {
				default:{
					Shape:{color:'gray'}
				},
				hover:{
					Shape:{color:'red'},
				}
			}

			proto.onFingerDown = function(){
				this.state = this.states.hover
			}

			// we should drag the selection start
			proto.onFingerMove = function(e){

			}

			proto.onFingerUp = function(){
				this.state = this.states.default
			}

			proto.onDraw = function(){
				this.drawShape(this)
			}
		})*/
	}

	//
	//
	// View 
	//
	//

	proto.onInit = function(){
		this.cs = new CursorSet(this)
		this.setFocus()
		this.$undoStack = []
		this.$redoStack = []
		this.$undoGroup = 0
	}

	proto.onHasFocus = function(){
		if(this.hasFocus){
			this.app.useSystemEditMenu(true)
		}
		else{
			this.app.useSystemEditMenu(false)
		}
		this.redraw()
	}

	//
	//
	// Drawing
	//
	//

	proto.onDraw = function(){

		this.beginBg(this.viewBgProps)

		this.drawSelect()

		this.drawText({
			wrapping:'line',
			$editMode:true,
			text:this.text
		})

		if(this.hasFocus){
			var cursors = this.cs.cursors
			for(var i = 0; i < cursors.length; i++){
				var cursor = cursors[i]

				var t = this.cursorRect(cursor.end)
				var boxes = this.$boundRectsText(cursor.lo(), cursor.hi())

				for(var j = 0; j < boxes.length;j++){
					var box = boxes[j]
					this.drawSelect({
						x:box.x,
						y:box.y,
						w:box.w,
						h:box.h
					})
					// lets tell the keyboard
				}
				/*
				if(cursor.byFinger && boxes.length){
					var box = boxes[0]
					this.drawSelectHandle({
						x:box.x-15,
						y:box.y-15,
						h:30,
						w:30
					})
					var box = boxes[boxes.length-1]
					this.drawSelectHandle({
						x:box.x+box.w-15,
						y:box.y+box.h-15,
						h:30,
						w:30
					})

				}*/

				this.drawCursor({
					x:t.x-1,
					y:t.y,
					w:2,
					h:t.h
				})
			}
		}
		this.endBg()
	}

	//
	//
	// Cursors
	//
	//

	var Cursor = require('class').extend(function Cursor(proto){
		proto.onConstruct = function(cursorSet, editor){
			this.cursorSet = cursorSet
			this.editor = editor 
			this.start = 0
			this.end = 0
			this.max = 0
		}

		proto.hi = function(){
			return this.start > this.end? this.start: this.end
		}

		proto.lo = function(){
			return this.start > this.end? this.end: this.start
		}

		proto.span = function(){
			return abs(this.start - this.end)
		}

		proto.hasSelection = function(){
			return this.start !== this.end
		}

		proto.moveDelta = function(delta, onlyEnd){
			this.end = clamp(this.end + delta, 0, this.editor.textLength())
			if(!onlyEnd){
				this.start = this.end
			}
			var rect = this.editor.textRect(this.end)
			this.max = rect?rect.x:0
			this.editor.cursorChanged(this)
		}

		proto.moveHome = function(onlyEnd){
			this.end = 0
			if(!onlyEnd) this.start = this.end
			var rect = this.editor.textRect(this.end)
			this.max = rect?rect.x:0
			this.editor.cursorChanged(this)
		}

		proto.moveEnd = function(onlyEnd){
			this.end = this.editor.textLength()
			if(!onlyEnd) this.start = this.end
			var rect = this.editor.textRect(this.end)
			this.max = rect?rect.x:0
			this.editor.cursorChanged(this)
		}

		proto.moveLine = function(lines, onlyEnd){
			var rect = this.editor.textRect(this.end)
			this.end = this.editor.offsetFromPos(this.max, rect.y + .5*rect.h + lines * rect.h)
			if(this.end < 0) this.end = 0
			if(!onlyEnd) this.start = this.end
			this.editor.cursorChanged(this)
		}
		
		proto.moveTo = function(x, y, onlyEnd){
			var end = this.editor.offsetFromPos(x, y)
			if(this.end === end) return
			this.end = end
			var rect = this.editor.cursorRect(this.end)
			this.max = rect?rect.x:0
			if(!onlyEnd) this.start = this.end
			this.editor.cursorChanged(this)
		}

		proto.moveWordRight = function(onlyEnd){
			this.moveDelta(this.editor.scanWordRight(this.end) - this.end, onlyEnd)
		}

		proto.moveWordLeft = function(onlyEnd){
			this.moveDelta(this.editor.scanWordLeft(this.end) - this.end, onlyEnd)
		}

		proto.moveLineLeft = function(onlyEnd){
			var delta = this.editor.scanLineLeft(this.end) - this.end
			this.moveDelta(delta, onlyEnd)
			return delta
		}

		proto.moveLineRight = function(onlyEnd){
			var delta = this.editor.scanLineRight(this.end) - this.end
			if(delta) this.moveDelta(delta, onlyEnd)
		}

		proto.moveLineLeftUp = function(onlyEnd){
			var delta = this.editor.scanLineLeft(this.end) - this.end
			if(delta) this.moveDelta(delta, onlyEnd)
			else this.moveLine(-1, onlyEnd)
		}

		proto.moveLineRightDown = function(onlyEnd){
			var delta = this.editor.scanLineRight(this.end) - this.end
			if(delta) this.moveDelta(delta, onlyEnd)
			else this.moveLine(1, onlyEnd)
		}

		proto.insertText = function(text){
   			var lo = this.lo(), hi = this.hi()

			this.editor.addUndoInsert(lo, hi)
			this.editor.removeText(lo, hi)
			this.cursorSet.delta -= this.span()
			var len = text.length
			if(len){
				this.editor.insertText(lo, text)
				this.cursorSet.delta += len
				this.editor.addUndoDelete(lo, lo +len)
			}
			this.start = this.end = lo
			this.editor.cursorChanged(this)
		}

		proto.deleteRange = function(lo, hi){
			if(lo === undefined) lo = this.lo()
			if(hi === undefined) hi = this.hi()
			this.editor.addUndoInsert(lo, hi)
			this.editor.removeText(lo, hi)
			this.cursorSet.delta -= hi - lo
			this.start = this.end = lo
			this.max = this.editor.cursorRect(this.end).x
			this.editor.cursorChanged(this)
		}

		proto.delete = function(){
			if(this.start !== this.end) return this.deleteRange()
			var next = this.end + 1
			this.editor.addUndoInsert(this.end, next)
			this.editor.removeText(this.end, next)
			this.cursorSet.delta -= 1
			this.editor.forkRedo()
			this.max = this.editor.cursorRect(this.end).x
			this.editor.cursorChanged(this)
		}

		proto.deleteWord = function(){
			// move start to beginning of word
			if(this.start !== this.end) return this.deleteRange()
			this.deleteRange(this.end, this.editor.scanWordRight(this.end))
		}

		proto.deleteLine = function(){
			// move start to beginning of word
			if(this.start !== this.end) return this.deleteRange()
			this.deleteRange(this.end, this.editor.scanLineRight(this.end))
		}

		proto.backSpace = function(){
			if(this.start !== this.end) return this.deleteRange()
			if(this.start === 0) return
			var prev = this.end - 1
			this.editor.addUndoInsert(prev, this.end)
			this.editor.removeText(prev, this.end)
			this.cursorSet.delta -= 1
			this.editor.forkRedo()
			this.start = this.end = prev
			this.max = this.editor.cursorRect(this.end).x
			this.editor.cursorChanged(this)
		}

		proto.backSpaceWord = function(){
			// move start to beginning of word
			if(this.start !== this.end) return this.deleteRange()
			this.deleteRange(this.editor.scanWordLeft(this.end))
		}

		proto.backSpaceLine = function(){
			// move start to beginning of word
			if(this.start !== this.end) return this.deleteRange()
			this.deleteRange(this.editor.scanLineLeft(this.end))
		}

		proto.select = function(start, end){
			this.start = start
			this.end = end
			this.editor.cursorChanged()
		}
	})

	var CursorSet = require('class').extend(function CursorSet(proto){

		function makeSetCall(key, fn){
			return function(){
				this.delta = 0
				var cursors = this.cursors
				for(var i = 0; i < cursors.length; i++){
					var cursor = cursors[i]
					cursor.start += this.delta
					cursor.end += this.delta
					cursor[key].apply(cursor, arguments)
				}
				this.updateSet()
			}
		}
		for(var key in Cursor.prototype){
			proto[key] = makeSetCall(key, Cursor.prototype[key])
		}

		proto.onConstruct = function(editor){
			this.editor = editor
			this.cursors = []
			this.addCursor()
		}

		proto.addCursor = function(){
			var cur = new Cursor(this, this.editor)
			this.cursors.push(cur)
			return cur
		}

		proto.clearCursors = function(){
			this.cursors = []
			return this.addCursor()
		}

		// set has changed
		proto.updateSet = function(){
			this.editor.redraw()
		}

		proto.serializeToArray = function(){
			var out = []
			for(var i = 0; i < this.cursors.length; i++){
				var cursor = this.cursors[i]
				out.push(cursor.start, cursor.end, cursor.max)
			}
			return out
		}

		proto.deserializeFromArray = function(inp){
			this.cursors = []
			for(var i = 0; i < inp.length; i += 3){
				var cursor = new Cursor(this, this.editor)
				cursor.start = inp[i]
				cursor.end = inp[i+1]
				cursor.max = inp[i+2]
				this.cursors.push(cursor)
			}
			this.updateSet()
		}

		proto.fuse = function(){

			this.cursors.sort(function(a,b){ return (a.start<a.end?a.start:a.end) < (b.start<b.end?b.start:b.end)? -1: 1})
			// lets do single pass
			for(var i = 0; i < this.cursors.length - 1;){
				var cur = this.cursors[i]
				var nxt = this.cursors[i + 1]
				if(cur.hi() >= nxt.lo()){
					if(cur.hi() <= nxt.hi()){
						if(nxt.end < nxt.start){
							cur.end = cur.lo()
							cur.start = nxt.hi()
						}
						else{
							cur.start = cur.lo()
							cur.end = nxt.hi()
						}
					}
					this.cursors.splice(i+1, 1)
				}
				else i++
			}
		}
	})


	//
	//
	// Editor cursor API
	//
	//

	proto.textRect = function(offset){
		var rd = this.$readOffsetText(offset)
		if(!rd) return
		return {
			x:rd.x,
			y:rd.y,
			w:rd.advance * rd.fontSize,
			h:rd.fontSize * rd.lineSpacing
		}
	}

	proto.cursorRect = function(offset){
		var rd = this.$readOffsetText(offset)
		if(!rd) return
		return {
			fontSize:rd.fontSize,
			advance:rd.advance,
			x:rd.x, //+ t.fontSize * t.x1,
			y:rd.y + this.cursorTrim * rd.fontSize,
			h:rd.fontSize * rd.lineSpacing - 2.* this.cursorTrim * rd.fontSize
		}
	}


	proto.offsetFromPos = function(x, y){
		var t = this.$seekPosText(x, y)

		if(t === -1) t = 0
		else if(t === -2) t = this.textLength() 
		return t
	}

	proto.textLength = function(){
		return this.text.length
	}

	proto.charAt = function(offset){
		return this.text.charAt(offset)
	}

	proto.charCodeAt = function(offset){
		return this.text.charCodeAt(offset)
	}

	proto.insertText = function(offset, text){
		this.text = this.text.slice(0, offset) + text + this.text.slice(offset)
		this.redraw()
	}

	proto.removeText = function(start, end){
		this.text = this.text.slice(0, start) + this.text.slice(end)
		this.redraw()
	}

	proto.serializeSlice = function(start, end){
		return this.text.slice(start, end)
	}

	function charType(char){
		if(char.match(/\w/))return 1
		if(char.match(/\s/))return 2
		return 3
	}

	proto.scanWordLeft = function(start){
		if(start == 0) return 0
		var i = start - 1, type = 2
		while(i>= 0 && type === 2) type = charType(this.charAt(i--))
		while(i>= 0 && type === charType(this.charAt(i))) i--
		return i + 1
	}

	proto.scanWordRight = function(start){
		var i = start, type = 2, len = this.textLength()
		if(this.text.charCodeAt(start) === 10) return start
		while(i < len && type === 2) type = charType(this.charAt(i++))
		while(i < len && type === charType(this.charAt(i))) i++
		return i
	}

	proto.scanLineLeft = function(start){
		for(var i = start - 1; i >= 0; i--){
			if(this.charCodeAt(i) === 10) break
		}
		return i + 1
	}

	proto.scanLineRight = function(start){
		for(var i = start; i < this.text.length; i++){
			if(this.charCodeAt(i) === 10) break
		}
		return i
	}

	proto.showLastCursor = function(){
		if(!this.cs) return

		// lets set the character accent menu pos
		var cursor = this.cs.cursors[this.cs.cursors.length - 1]
		var rd = this.cursorRect(cursor.end)

		// ok so lets move the thing into view
		this.scrollIntoView(rd.x-.5*rd.fontSize, rd.y, .5*rd.fontSize, rd.h)

		//console.log(rd.y - this.todo.yScroll, this.todo.yView)
		this.app.setCharacterAccentMenuPos(
			rd.x + 0.5 * rd.advance - this.todo.xScroll, 
			rd.y - this.todo.yScroll
		)
	}

	// serialize all selections, lazily
	proto.cursorChanged = function(){

		if(!this.$selChangeTimer) this.$selChangeTimer = setTimeout(function(){
			this.$selChangeTimer = undefined

			// lets fuse em
			this.cs.fuse()

			var txt = ''
			for(var i = 0; i < this.cs.cursors.length; i++){
				var cursor = this.cs.cursors[i]
				txt += this.text.slice(cursor.lo(), cursor.hi())
			}

			this.app.setClipboardText(txt)

			this.showLastCursor()

			this.redraw()
		}.bind(this))
	}

	//
	//
	// Undo stack
	//
	//

	proto.addUndoInsert = function(start, end, stack){
		if(!stack) stack = this.$undoStack
		var last = stack[stack.length - 1]
		if(last && last.type === 'insert' && last.start == end){
			var group = last.group
			last.group = this.$undoGroup
			for(var i = stack.length - 2; i >= 0; i--){
				if(stack[i].group === group) stack[i].group = this.$undoGroup
			}
		}
		stack.push({
			group: this.$undoGroup,
			type:'insert',
			start:start,
			data: this.serializeSlice(start, end),
			cursors: this.cs.serializeToArray()
		})
	}

	proto.addUndoDelete = function(start, end, stack){
		if(!stack) stack = this.$undoStack
		var last = stack[stack.length - 1]
		if(last && last.type === 'delete' && last.end === start){
			last.end += end - start
			return
		}
		stack.push({
			group: this.$undoGroup,
			type:'delete',
			start:start,
			end:end,
			cursors:this.cs.serializeToArray()
		})
	}

	proto.forkRedo = function(){
		if(this.$undoStack.length){
			this.$undoStack[this.$undoStack.length -1].redo = this.$redoStack
		}
		this.$redoStack = []
	}

	proto.undoRedo = function(stack1, stack2){
		if(!stack1.length) return
		var lastGroup = stack1[stack1.length - 1].group
		for(var i = stack1.length - 1; i >= 0; i--){
			var item = stack1[i]
			var lastCursors
			if(item.group !== lastGroup) break
			if(item.type === 'insert'){
				this.addUndoDelete(item.start, item.start + item.data.length, stack2)
				this.insertText(item.start, item.data)
				lastCursors = item.cursors
			}
			else{
				this.addUndoInsert(item.start, item.end, stack2)
				this.removeText(item.start, item.end)
				lastCursors = item.cursors
			}
		}
		stack1.splice(i+1)
		this.cs.deserializeFromArray(lastCursors)
	}

	//
	//
	// Command keys
	//
	//

	proto.onKeyZ =
	proto.onKeyZ = function(k){
		if(!k.ctrl && !k.meta) return
		this.$undoGroup++
		this.undoRedo(this.$undoStack, this.$redoStack)
	}

	proto.onKeyY =
	proto.onKeyY = function(k){
		if(!k.ctrl && !k.meta) return
		this.$undoGroup++
		this.undoRedo(this.$redoStack, this.$undoStack)
	}
	
	proto.pageSize = 70

	proto.onKeyPageUp = function(k){
		this.cs.moveLine(-this.pageSize, k.shift)
	}

	proto.onKeyPageDown = function(k){
		this.cs.moveLine(this.pageSize, k.shift)
	}

	proto.onKeyHome = function(k){
		if(k.ctrl || k.alt) return this.cs.moveHome(k.shift)
		return this.cs.moveLineLeft(k.shift)
	}

	proto.onKeyEnd = function(k){
		if(k.ctrl || k.alt) return this.cs.moveEnd(k.shift)
		return this.cs.moveLineRight(k.shift)
	}

	proto.onKeyLeftArrow = function(k){
		if(k.ctrl || k.alt) return this.cs.moveWordLeft(k.shift)
		if(k.meta) return this.cs.moveLineLeft(k.shift)
		this.cs.moveDelta(-1, k.shift)
	}

	proto.onKeyRightArrow = function(k){
		if(k.ctrl || k.alt) return this.cs.moveWordRight(k.shift)
		if(k.meta) return this.cs.moveLineRight(k.shift)
		this.cs.moveDelta(1, k.shift)
	}

	proto.onKeyUpArrow = function(k){
		if(k.ctrl) return this.onKeyPageUp(k)
		if(k.alt) return this.cs.moveLineLeftUp(k.shift)
		if(k.meta) return this.onKeyHome(k)
		this.cs.moveLine(-1, k.shift)
	}

	proto.onKeyDownArrow = function(k){
		if(k.ctrl) return this.onKeyPageDown(k)
		if(k.alt) return this.cs.moveLineRightDown(k.shift)
		if(k.meta) return this.onKeyEnd(k)
		this.cs.moveLine(1, k.shift)
	}

	proto.onKeyBackSpace = function(k){
		this.$undoGroup++
		if(k.ctrl || k.alt) return this.cs.backSpaceWord()
		if(k.meta) return this.cs.backSpaceLine()
		this.cs.backSpace()
	}

	proto.onKeyDelete = function(k){
		this.$undoGroup++
		if(k.ctrl || k.alt) return this.cs.deleteWord()
		if(k.meta) return this.cs.deleteLine()
		this.cs.delete()
	}

	proto.onKeyEnter = function(k){
		this.$undoGroup++
		this.cs.insertText('\n')
		this.cs.moveDelta(1)
	}

	proto.onKeyX = function(k){
		if(!k.ctrl && !k.meta) return
		this.$undoGroup++
		this.cs.delete()		
	}

	proto.onKeyA = function(k){
		if(!k.ctrl && !k.meta) return
		// select all
		var cur = this.cs.clearCursors()
		cur.select(0, this.textLength())
	}

	proto.onKeyDown = function(k){
		// lets trigger an event
		var name = k.name
		var prefix = ''
		var evname = 'onKey' + name.charAt(0).toUpperCase()+name.slice(1)
		if(this[evname]) return this[evname](k)
	}

	// move the cursor into view when the keyboard opens on mobile
	proto.onKeyboardOpen = function(){
		this.showLastCursor()
	}

	//
	//
	// Character input
	//
	//

	proto.onKeyPaste = function(k){
		this.$undoGroup ++
		this.cs.insertText(k.text)
		this.cs.moveDelta(k.text.length)
	}
	
	proto.onKeyPress = function(k){
		this.$undoGroup ++
		var out = String.fromCharCode(k.char === 13?10:k.char)
		// lets run over all our cursors
		// if repeat is -1 we have to replace last char
		if(k.special){
			this.cs.backSpace()			
		}
		this.cs.insertText(out)
		this.cs.moveDelta(1)
	}

	//
	//
	// touch/mouse input
	//
	//
	
	proto.onFingerDown = function(f){
		if(f.digit!== 1 || f.button !== 1 || f.pickId !== 0)return
		if(f.touch && f.tapCount < 1) return// && this.cs.cursors[0].hasSelection()) return

		this.setFocus() 

		if(f.meta){
			this.fingerCursor = this.cs.addCursor()
		}
		else{
			var oldstart = this.cs.cursors[0].start
			this.fingerCursor = this.cs.clearCursors()
			this.fingerCursor.start = oldstart
		}

		var touchdy = 0//f.touch?-20:0
		this.fingerCursor.moveTo(f.x, f.y+touchdy, f.shift)	
		
		var tapDiv = f.touch?4:3, tapStart = f.touch?2:1
		if(f.tapCount%tapDiv === tapStart+0){ // select word under finger
			var x = this.fingerCursor.end
			this.fingerCursor.select(this.scanWordLeft(x), this.scanWordRight(x))
			this.fingerCursor.byFinger = true
		}
		else if(f.tapCount%tapDiv === tapStart+1){ // select line
			var x = this.fingerCursor.end
			this.fingerCursor.select(this.scanLineLeft(x), this.scanLineRight(x)+1)
			this.fingerCursor.byFinger = true
		}

		//this.redraw()
	}

	proto.onFingerMove = function(f){
		if(f.digit!== 1 || f.button !== 1 || f.pickId !== 0)return
		var touchdy = 0//f.touch?-20:0
		if(f.touch && f.tapCount < 1){
			return
		}
		this.fingerCursor.byFinger = true

		this.fingerCursor.moveTo(f.x, f.y+touchdy, true)

		var tapDiv = f.touch?4:3, tapStart = f.touch?2:1
		if(f.tapCount%tapDiv === tapStart+0){
			if(this.fingerCursor.end < this.fingerCursor.start){
				this.fingerCursor.end = this.scanWordLeft(this.fingerCursor.end)
			}
			else{
				this.fingerCursor.end = this.scanWordRight(this.fingerCursor.end)
			}

		}
		else if(f.tapCount%tapDiv === tapStart+1){ // select line
			if(this.fingerCursor.end < this.fingerCursor.start){
				this.fingerCursor.end = this.scanLineRight(this.fingerCursor.end)+1
			}
			else {
				this.fingerCursor.end = this.scanLineLeft(this.fingerCursor.end)
			}
		}
	}

	proto.onFingerUp = function(f){
		if(f.digit!== 1 || f.button !== 1 || f.pickId !== 0)return
		this.fingerCursor = undefined
		var touchdy = 0//f.touch?-20:0
		if(f.touch && f.tapCount === 1){// && this.cs.cursors[0].hasSelection()){
			var cursor = this.cs.clearCursors()
			cursor.moveTo(f.x, f.y+touchdy, false)
			this.app.setKeyboardFocus(true)
		}
		//this.redraw()
	}

})