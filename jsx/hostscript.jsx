function applyEasing(b) {
    app.beginUndoGroup("Zen Ease - Apply Easing");
    try {
        var comp = app.project.activeItem;
        if (!(comp instanceof CompItem)) { return "ERROR: Please open a composition."; }
        
        var props = comp.selectedProperties;
        if (!props.length) { return "ERROR: Please select a property with keyframes."; }
        
        var appliedCount = 0;

        for (var pIdx = 0; pIdx < props.length; pIdx++) {
            var p = props[pIdx];
            if (!p.canVaryOverTime || p.numKeys < 2) continue;
            
            var keys = p.selectedKeys;
            if (keys.length < 2) continue;
            
            appliedCount++;

            for (var kIdx = 0; kIdx < keys.length - 1; kIdx++) {
                var k1 = keys[kIdx];
                var k2 = keys[kIdx + 1];
                
                // Force Bezier interpolation and break temporal continuity to prevent overshoots
                p.setInterpolationTypeAtKey(k1, p.keyInInterpolationType(k1), KeyframeInterpolationType.BEZIER);
                p.setInterpolationTypeAtKey(k2, KeyframeInterpolationType.BEZIER, p.keyOutInterpolationType(k2));
                p.setTemporalContinuousAtKey(k1, false);
                p.setTemporalContinuousAtKey(k2, false);

                var dt = p.keyTime(k2) - p.keyTime(k1);
                var dv = calculateDV(p, k1, k2);
                
                var n = 1;
                var isSpatial = (p.propertyValueType === PropertyValueType.TwoD_SPATIAL || p.propertyValueType === PropertyValueType.ThreeD_SPATIAL);
                var isShape = (p.propertyValueType === PropertyValueType.SHAPE);
                
                if (!isSpatial && !isShape) {
                    var val = p.keyValue(k1);
                    if (val instanceof Array) n = val.length;
                }
                
                var eo = [], ei = [];
                for (var i = 0; i < n; i++) {
                    // Use signed displacement for non-spatial properties to handle direction correctly
                    var channelDV = (n > 1 && !isSpatial && !isShape) ? (p.keyValue(k2)[i] - p.keyValue(k1)[i]) : dv;
                    var avg = channelDV / dt;
                    
                    var sOut = b[0] > 0 ? avg * (b[1] / b[0]) : 0;
                    var sIn = (1 - b[2]) > 0 ? avg * ((1 - b[3]) / (1 - b[2])) : 0;
                    
                    // KeyframeEase speed should be signed for multi-dimensional properties to indicate direction
                    eo.push(new KeyframeEase(sOut, Math.max(0.1, Math.min(100, b[0] * 100))));
                    ei.push(new KeyframeEase(sIn, Math.max(0.1, Math.min(100, (1 - b[2]) * 100))));
                }
                
                p.setTemporalEaseAtKey(k1, p.keyInTemporalEase(k1), eo);
                p.setTemporalEaseAtKey(k2, ei, p.keyOutTemporalEase(k2));
            }
        }
        
        if (appliedCount === 0) return "ERROR: Please select at least two keyframes.";
        return "OK";
    } catch(e) {
        return "ERROR: " + e.toString();
    } finally {
        app.endUndoGroup();
    }
}

function getEasing() {
    try {
        var comp = app.project.activeItem;
        if (!(comp instanceof CompItem)) { return "ERROR: Open a composition."; }
        
        var props = comp.selectedProperties;
        if (!props.length) { return "ERROR: Select a property."; }
        
        var p = props[0];
        var keys = p.selectedKeys;
        if (keys.length < 2) { return "ERROR: Select at least two keyframes."; }
        
        var k1 = keys[0];
        var k2 = keys[1];
        
        var dt = p.keyTime(k2) - p.keyTime(k1);
        
        // For multi-dimensional properties, find the dimension with the most change to get a better 'avg'
        var v1 = p.keyValue(k1);
        var v2 = p.keyValue(k2);
        var dimIdx = 0;
        if (v1 instanceof Array && !(p.propertyValueType === PropertyValueType.TwoD_SPATIAL || p.propertyValueType === PropertyValueType.ThreeD_SPATIAL)) {
            var maxDiff = -1;
            for (var i = 0; i < v1.length; i++) {
                var diff = Math.abs(v2[i] - v1[i]);
                if (diff > maxDiff) {
                    maxDiff = diff;
                    dimIdx = i;
                }
            }
        }

        var dv = calculateDV(p, k1, k2);
        // Use signed distance for the selected dimension
        if (v1 instanceof Array && maxDiff !== undefined) dv = (v2[dimIdx] - v1[dimIdx]);
        
        var avg = dv / dt;
        
        var eo = p.keyOutTemporalEase(k1)[dimIdx];
        var ei = p.keyInTemporalEase(k2)[dimIdx];
        
        var b0 = eo.influence / 100;
        // Use Math.abs for the handle calculation to keep it positive in the UI
        var b1 = (avg !== 0) ? Math.abs(eo.speed / avg) * b0 : 0;
        
        var b2 = 1 - (ei.influence / 100);
        var b3 = 1 - ((avg !== 0) ? Math.abs(ei.speed / avg) * (1 - b2) : 0);
        
        return JSON.stringify([b0, b1, b2, b3]);
    } catch(e) {
        return "ERROR: " + e.toString();
    }
}

function calculateDV(p, k1, k2) {
    var v1 = p.keyValue(k1);
    var v2 = p.keyValue(k2);
    var t1 = p.keyTime(k1);
    var t2 = p.keyTime(k2);
    
    // For Spatial properties (Position), we need to approximate the arc length if the path is curved
    if (p.propertyValueType === PropertyValueType.TwoD_SPATIAL || p.propertyValueType === PropertyValueType.ThreeD_SPATIAL) {
        var samples = 10; // 10 samples is usually plenty for a precise speed match
        var arcLength = 0;
        var prevVal = v1;
        for (var s = 1; s <= samples; s++) {
            var t = t1 + (t2 - t1) * (s / samples);
            var currVal = p.valueAtTime(t, true);
            var sumSq = 0;
            for (var i = 0; i < currVal.length; i++) {
                sumSq += Math.pow(currVal[i] - prevVal[i], 2);
            }
            arcLength += Math.sqrt(sumSq);
            prevVal = currVal;
        }
        return arcLength;
    }
    
    if (p.propertyValueType === PropertyValueType.SHAPE) {
        var dist = 0;
        var verts1 = v1.vertices;
        var verts2 = v2.vertices;
        var len = Math.min(verts1.length, verts2.length);
        for (var i = 0; i < len; i++) {
            dist += Math.sqrt(Math.pow(verts2[i][0] - verts1[i][0], 2) + Math.pow(verts2[i][1] - verts1[i][1], 2));
        }
        return dist;
    }
    
    if (v1 instanceof Array) {
        return Math.abs(v2[0] - v1[0]); // Default to first dimension for avg speed reference
    }
    
    return Math.abs(v2 - v1);
}
