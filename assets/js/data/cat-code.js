/* ==========================================================================
 * 书库分类数据：程序预存字（#33 新建，规格修正版）
 * Java / Python / JavaScript / C++ 各 8 组，共 32 组；
 * 每组为空格分隔的纯单词列表（关键字 + 高频标识符/库词），不含句子、
 *   标点、括号、分号；字符集仅 [A-Za-z0-9_ ]，单词间单空格，组内不重复；
 *   大小写敏感错字判定（大写、下划线打错均判 wrong）。
 * id 段：Java 101–108、Python 109–116、JavaScript 117–124、C++ 125–132
 * 挂载：window.TP_CATS.code = { id, name, articles:[{id,title,text}] }
 * ========================================================================== */
window.TP_CATS = window.TP_CATS || {};
window.TP_CATS.code = {
  id: "code",
  name: "程序预存字",
  articles: [
    {
      id: 101,
      title: "Java · 基础关键字",
      text: "MAX_VALUE int float double char String boolean void byte long short class interface enum extends implements public private protected static final new return if else for while switch case break continue try catch finally throw import package this super null"
    },
    {
      id: 102,
      title: "Java · 常用类名",
      text: "String Integer Double Boolean Character Number Object System Math StringBuilder StringBuffer Random Scanner Arrays Collections Comparable Runnable Callable Override Deprecated Thread Exception Error Record Optional Stream Collectors Formatter ProcessBuilder Calendar TimeZone Locale Charset Path Files"
    },
    {
      id: 103,
      title: "Java · 集合框架",
      text: "List ArrayList LinkedList Map HashMap LinkedHashMap TreeMap Set HashSet LinkedHashSet TreeSet Queue Deque ArrayDeque PriorityQueue Iterator Comparator Collection Entry KeySet values put get add remove size clear containsKey isEmpty putIfAbsent computeIfAbsent key_set entry_set put_all remove_if"
    },
    {
      id: 104,
      title: "Java · 异常与流",
      text: "Exception RuntimeException NullPointerException IllegalArgumentException IllegalStateException IndexOutOfBoundsException IOException FileNotFoundException SQLException ClassNotFoundException Throwable getMessage printStackTrace StackTraceElement BufferedReader InputStreamReader FileInputStream FileOutputStream OutputStreamWriter close flush read write readLine error_code stack_trace"
    },
    {
      id: 105,
      title: "Java · 并发编程",
      text: "Thread Runnable synchronized volatile ThreadLocal ExecutorService ThreadPoolExecutor Executors Future CompletableFuture CountDownLatch CyclicBarrier Semaphore ReentrantLock ConcurrentHashMap BlockingQueue AtomicBoolean AtomicInteger AtomicLong newThread start join sleep submit shutdown await pool_size task_queue"
    },
    {
      id: 106,
      title: "Java · 方法与惯用名",
      text: "main args println printf print format equals hashCode toString compareTo length valueOf parseInt parseDouble substring indexOf split trim replace toUpperCase toLowerCase charAt isEmpty concat contains startsWith endsWith getOrDefault get_name set_data read_only"
    },
    {
      id: 107,
      title: "Java · 标识符词汇",
      text: "userName userId user_id firstName lastName account balance order_id orderCount itemCount total_price unitPrice maxRetries timeoutMillis buffer_size chunk Capacity cursor index offset limit is_valid is_deleted has_next node_count temp_value result_list data_map"
    },
    {
      id: 108,
      title: "Java · Stream 与泛型",
      text: "stream filter map reduce collect forEach sorted distinct limit skip flatMap groupingBy counting toList toSet joining anyMatch allMatch noneMatch findFirst orElse ifPresent generic Type Parameter Wildcard Bound Supplier Function Predicate Consumer map_values"
    },
    {
      id: 109,
      title: "Python · 基础关键字",
      text: "def class return yield lambda global nonlocal import from as pass break continue if elif else while for in is not and or None True False try except finally raise with assert del async await match case"
    },
    {
      id: 110,
      title: "Python · 内置类型与函数",
      text: "int float str bool list dict tuple set bytes bytearray complex frozenset len range print input open isinstance issubclass type id hash abs min max sum sorted reversed enumerate zip map filter any all repr format iter next callable"
    },
    {
      id: 111,
      title: "Python · 常用标识符",
      text: "self cls main name file path data result value index count total items names keys values temp buffer cache queue stack counter flag state config settings options params args kwargs context logger MAX_SIZE MIN_VALUE DEFAULT_PORT is_ready has_data get_name data_dir"
    },
    {
      id: 112,
      title: "Python · 标准库词汇",
      text: "os sys json re math time datetime random itertools functools collections typing pathlib argparse logging unittest subprocess threading multiprocessing socket struct copy pprint string textwrap heapq bisect array decimal fractions statistics"
    },
    {
      id: 113,
      title: "Python · 面向对象",
      text: "object property staticmethod classmethod super init new del attr setter getter abstract base ABCMeta inherit override polymorphism encapsulation instance method attribute dunder repr str eq lt hash bool len iter contains dunder_init dunder_repr"
    },
    {
      id: 114,
      title: "Python · 异常处理",
      text: "Exception BaseException ValueError TypeError KeyError IndexError AttributeError NameError ZeroDivisionError FileNotFoundError IOError OSError ImportError RuntimeError StopIteration ArithmeticError LookupError traceback errno message args with_traceback raise_from"
    },
    {
      id: 115,
      title: "Python · 异步编程",
      text: "asyncio async await coroutine gather create_task sleep Queue Event Loop Future Task run_until_complete get_event_loop iscoroutinefunction awaitable concurrent futures threading Lock Semaphore Condition as_completed timeout"
    },
    {
      id: 116,
      title: "Python · 惯用命名",
      text: "user_name user_id first_name last_name is_valid is_empty has_next max_retries timeout_seconds buffer_size chunk_size data_list data_dict data_set temp_file log_file config_path parse_args read_lines write_csv to_json from_json get_item set_item"
    },
    {
      id: 117,
      title: "JavaScript · 基础关键字",
      text: "var let const function return yield class extends super new delete typeof instanceof in of if else for while do switch case break continue try catch finally throw import export default as async await void null undefined true false this"
    },
    {
      id: 118,
      title: "JavaScript · 内置对象与方法",
      text: "Object Array String Number Boolean Symbol Math JSON Date Promise Map Set WeakMap WeakSet RegExp Error Function parseInt parseFloat isNaN encodeURI decodeURI setTimeout setInterval clearTimeout clearInterval console log warn error keys values entries assign freeze"
    },
    {
      id: 119,
      title: "JavaScript · 常用标识符",
      text: "window document navigator location history localStorage sessionStorage element node parent children length innerHTML textContent className classList style value checked disabled focus blur click submit reset querySelector querySelectorAll addEventListener removeEventListener"
    },
    {
      id: 120,
      title: "JavaScript · ES6+ 词汇",
      text: "arrow spread rest destructuring template literal module export import default getter setter proxy reflect promise async generator iterable iterator symbol prototype constructor super extends mixin polyfill transpile callback"
    },
    {
      id: 121,
      title: "JavaScript · Node 与工程",
      text: "require exports module process buffer stream server client request response router middleware endpoint handler controller service repository database query schema model express react vue angular webpack babel npm yarn node env_var src_path out_dir"
    },
    {
      id: 122,
      title: "JavaScript · 异常与调试",
      text: "Error TypeError RangeError ReferenceError SyntaxError EvalError URIError message name stack trace catch finally throw reject resolve unhandledrejection console debugger breakpoint source map minify lint test debug"
    },
    {
      id: 123,
      title: "JavaScript · 数组方法",
      text: "push pop shift unshift slice splice concat join split map filter reduce find findIndex some every forEach indexOf includes sort reverse flat flatMap fill copyWithin entries keys values from isArray"
    },
    {
      id: 124,
      title: "JavaScript · 惯用命名",
      text: "user_name user_id userAge firstName lastName isActive isHidden hasError maxRetries timeoutMs bufferLength itemList item_count dataMap data_map tempValue oldValue newValue currentIndex pageSize totalCount onLoad onClick onSubmit fetchData renderView"
    },
    {
      id: 125,
      title: "C++ · 基础关键字",
      text: "auto const constexpr static extern volatile inline virtual override final class struct union enum namespace template typename public protected private friend new delete sizeof using typedef decltype nullptr return if else for while switch case break continue throw try catch"
    },
    {
      id: 126,
      title: "C++ · 标准库类型",
      text: "int float double char bool short long unsigned signed void string wstring vector list deque map set multimap multiset unordered_map unordered_set array stack queue priority_queue pair tuple optional variant any shared_ptr unique_ptr weak_ptr"
    },
    {
      id: 127,
      title: "C++ · STL 算法",
      text: "sort stable_sort find find_if count count_if copy copy_if transform for_each remove remove_if unique reverse accumulate min max min_element max_element swap move fill erase clear empty size begin end push_back pop_back emplace_back merge_n sort_by"
    },
    {
      id: 128,
      title: "C++ · 流与 IO",
      text: "iostream istream ostream fstream stringstream cin cout cerr endl ifstream ofstream getline flush precision setw setfill ios printf scanf puts fgets FILE stdin stdout stderr file_buf read_all write_all"
    },
    {
      id: 129,
      title: "C++ · 智能指针与内存",
      text: "shared_ptr unique_ptr weak_ptr make_shared make_unique new delete malloc calloc realloc free memcpy memset memmove allocator deallocate construct destroy dereference nullptr_t use_count reset release get ref_count alloc_size mem_pool"
    },
    {
      id: 130,
      title: "C++ · 并发编程",
      text: "thread mutex lock_guard unique_lock shared_lock atomic condition_variable async future promise packaged_task call_once memory_order acquire release relaxed seq_cst join detach notify_one notify_all thread_id spin_lock"
    },
    {
      id: 131,
      title: "C++ · 异常处理",
      text: "exception runtime_error logic_error invalid_argument out_of_range bad_alloc bad_cast noexcept throw catch try static_assert terminate abort assert error_code err_msg what strerror nested_exception"
    },
    {
      id: 132,
      title: "C++ · C 风格与惯用名",
      text: "struct typedef enum sizeof union static const extern inline register volatile sig_atomic_t int8_t int16_t int32_t int64_t uint8_t uint16_t uint32_t uint64_t size_t ptrdiff_t NULL ptr buf buf_size node_count head tail next prev data_ptr temp_val max_len str_len"
    }
  ]
};
