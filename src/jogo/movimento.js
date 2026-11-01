function speedKmh(){return 2+speedLevel()*.5}
function movementSpeed(){return meters(speedKmh()/3.6)}
function movementVector(sx,sy,yaw=viewYaw){let l=Math.max(1,Math.hypot(sx,sy)),c=Math.cos(yaw),s=Math.sin(yaw);return {x:(sx*c+sy*s)/l,y:(-sx*s+sy*c)/l}}
