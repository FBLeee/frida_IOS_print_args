// color着色
var Color = {
    RESET: "\x1b[39;49;00m", Black: "0;01", Blue: "4;01", Cyan: "6;01", Gray: "7;01", Green: "2;01", Purple: "5;01", Red: "1;01", Yellow: "3;01",
    Light: {
        White: "0;11", Black: "4;11", Cyan: "6;11", Gray: "7;01", Green: "2;11", Purple: "5;11", Red: "1;11", Yellow: "3;11"
    }
};
var LOG = function (input, kwargs) {
    kwargs = kwargs || {};
    var logLevel = kwargs['l'] || 'log', colorPrefix = '\x1b[3', colorSuffix = 'm';
    if (typeof input === 'object')
        input = JSON.stringify(input, null, kwargs['i'] ? 2 : null);
    if (kwargs['c'])
        input = colorPrefix + kwargs['c'] + colorSuffix + input + Color.RESET;
    console[logLevel](input);
};


// 打印确认信息
function print_ack_info(name, module, offset) {
    var func_addr = get_func_addr(name, module, offset);//以基地址0为前提！
    console.log('func_addr: ' + func_addr);
    console.log(hexdump(ptr(func_addr), {
        length: 16,
        header: true,
        ansi: true
    }))
    return func_addr;
}
//1.获取基址
var AES_KEY_length = 0;
function get_func_addr(name, module, offset) {
    var base_addr = Module.findBaseAddress(module);
    console.log("\r\n\n\n------------开始hook   " + name + "   ------------");
    console.log("base_addr: " + base_addr);
    console.log(hexdump(ptr(base_addr), {
        length: 16,
        header: true,
        ansi: true
    }))
    var func_addr = base_addr.add(offset);
    if (Process.arch == 'arm')
        return func_addr.add(1);  //如果是32位地址+1
    else
        return func_addr;
}


//2.0 获取NString对象
function print_NString(name, a) {
    var objcHttpUrl = ObjC.Object(a);
    var strHttpUrl = objcHttpUrl.UTF8String();
    LOG("\n[+]   " + name + strHttpUrl, { c: Color.Green });
    // console.log("\r\n", name, strHttpUrl);
}

//2.1 获取NSData对象
function print_NSData(name, a) {
    var objcData = ObjC.Object(a);
    var strBody = objcData.bytes().readUtf8String(objcData.length());
    LOG("\n[+]   " + name + strBody, { c: Color.Purple });
    // console.log("---NSData:", strBody);
}

//2.2 获取NSData_hex对象
function print_NSData_hex(a, len) {
    var objcHttpUrl = ObjC.Object(a);
    if (len == 0) {
        console.log(hexdump(objcHttpUrl.bytes(), {
            // length: 16,
            header: true,
            ansi: true
        }))
    } else {
        console.log(hexdump(objcHttpUrl.bytes(), {
            length: len,
            header: true,
            ansi: true
        }))
    }
}

//2.3 获取NSDic对象
function print_NSDic(a) {
    //3.遍历NSDictionary的代码（key：value这种的）
    var dict = new ObjC.Object(a);
    var enumerator = dict.keyEnumerator();
    var key;
    console.log("\n");
    while ((key = enumerator.nextObject()) !== null) {
        var value = dict.objectForKey_(key);
        LOG("[+]   " + key + " : " + value, { c: Color.Yellow });
        // console.log("\t\t", key, " : ", value)
    }
}

//2.4 获取NSObjectDic对象
function print_NSObjectDic(a) {
    // 如果是自定义对象时，使用以上方法无法打印时，请使用以下方法：
    var customObj = ObjC.Object(a); // 自定义对象
    // 打印该对象所有属性
    var ivarList = customObj.$ivars;
    console.log("\n");
    for (var key in ivarList) {
        // console.log(`${key}:${ivarList[key]}`);
        LOG("[+]   " + `${key}:${ivarList[key]}`, { c: Color.Blue });
        if (key == "_preferenceHelper") {
            var customObj_preferenceHelper = ObjC.Object(ivarList[key]); // 自定义对象
            var inline_ivarList = customObj_preferenceHelper.$ivars;
            for (var key_inline in inline_ivarList) {
                // console.log(`\t\t${key_inline}:${inline_ivarList[key_inline]}`);
                LOG("[+]   " + `\t\t${key_inline}:${inline_ivarList[key_inline]}`, { c: Color.Blue });
            }
        }
    }
}

//2.5 获取NSStackBlock对象
function print_NSStackBlock(a) {
    var block = new ObjC.Block(a);
    const appCallback = block.implementation;
    // console.log(appCallback);
    LOG("\n[+]   " + appCallback, { c: Color.Cyan });
    block.implementation = function (error, value) {
        // console.log(error) // ALBBResponse
        var result = appCallback(error, null);
        LOG("[+]   " + result, { c: Color.Cyan });
        return result;
    };
}






// 初步部分打印结果
function print_auto(name, a, a_len = 0, auto = true) {
    if (auto) {
        if (name == "方法名") {
            LOG("\n[+]   " + "方法名: " + ObjC.selectorAsString(a), { c: Color.Black });
        } else if (name == "源数据") {
            LOG("\n[+]   " + "源数据: " + new ObjC.Object(a), { c: Color.Black });
        } else {
            LOG("\n[+]   " + name + "_type: " + ObjC.Object(a).$className, { c: Color.Gray });
            if (ObjC.Object(a).$className.indexOf("String") != -1) {
                print_NString(name, a);
            } else if (ObjC.Object(a).$className.indexOf("Dic") != -1) {
                print_NSDic(a);
            } else if (ObjC.Object(a).$className.indexOf("Block") != -1) {
                print_NSStackBlock(a);
            } else if (ObjC.Object(a).$className.indexOf("Data") != -1) {
                print_NSData_hex(a, a_len);
            } else {
                print_NSObjectDic(a);
            }
        }
    } else {
        // 自定义
        LOG("\n[+]   " + name + "\t" + a, { c: Color.Gray });
    }
}






// ===============================================================================
function print(name, module, offset) {
    var func_addr = print_ack_info(name, module, offset);
    //4.1附加      
    Interceptor.attach(
        func_addr, {
        onEnter: function (args) {
            print_auto("args_0", args[0]);
            print_auto("方法名", args[1]);
            print_auto("args_2", args[2]);
            print_auto("args_3", args[3]);
            print_auto("args_4", args[4]);
            print_auto("args_5", args[5]);
        },
        onLeave: function (retval) {
        }
    });
}
// ---------------------------------------------------------------
print("xxxx", 'Unix可执行文件的name', offset);
