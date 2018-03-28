// http://php2javascript.runtimeconverter.com/

var md5sum = require('md5');
var ctype_alpha = require('locutus/php/ctype/ctype_alpha');
var ctype_alnum = require('locutus/php/ctype/ctype_alnum');

function is_numeric( mixed_var ) {
	return !isNaN( mixed_var ) && /\S/.test(mixed_var);
}

function is_string( mixed_var ){
    return (typeof( mixed_var ) == 'string');
}


var Basic = (function() {
    function Basic() {
        /**
         * The Basic class acts as the lexer and intepreter, so we want to keep
         * track of a few bits during interpretation, including variables
         */
        this.variables = {};
        this.statements = [];
        this.labels = {};
        this.current_statement = 0;
        this.md5 = "";
    }

    Basic.TOKEN_WORD = 1;
    Basic.TOKEN_NUMBER = 2;
    Basic.TOKEN_STRING = 3;
    Basic.TOKEN_LABEL = 4;
    Basic.TOKEN_EQUALS = 5;
    Basic.TOKEN_OPERATOR = 6;
    Basic.TOKEN_LEFT_PARENTHESIES = 7;
    Basic.TOKEN_RIGHT_PARENTHESIES = 8;
    Basic.TOKEN_EOF = 9;
    Basic.S_DEFAULT = 1;
    Basic.S_WORD = 2;
    Basic.S_NUMBER = 3;
    Basic.S_STRING = 4;
    Basic.S_COMMENT = 5;
    /**
     * This function runs the BASIC source through the interpretation
     * pipeline; tokenising, parsing and executing the code.
     *
     * @param {string} source The BASIC source code
     * @return void
     * @author Jamie Rumbelow
     */
    Basic.prototype.interpret = function(source) {
        this.preinterpret(source);
        // Loop through the statements and execute them
            while (this.current_statement < this.statements.length) {
                this.statements[this.current_statement].execute();
                this.current_statement++;
            }
    };
    Basic.prototype.preinterpret = function(source) {
        this.md5 = md5sum(source);
        // Tokenise
        var tokens = this.tokenise(source);
        // Parse
        var parser = new Parser(this, tokens);
        this.current_statement = 0;
        parser.parse();
    };
    Basic.prototype.getStateKey = function(md5, id) {
        if (typeof id == 'undefined') id = 0;
        return "state:" + md5 + ":" + id;
    };
    Basic.prototype.loadState = function(redis, id) {
        if (typeof id == 'undefined') id = 0;
        var key;
        key = this.getStateKey(this.md5, id);
        var resp;
        resp = redis.get(key);
        if (resp) {
            var state;
            state = json_decode(resp);
            if (state) {
                this.current_statement = state["current_statement"];
                this.variables = state["variables"];
            }
        }
    };
    Basic.prototype.saveState = function(redis, id, debug) {
        if (typeof id == 'undefined') id = 0;
        if (typeof debug == 'undefined') debug = false;
        var key;
        key = this.getStateKey(this.md5, id);
        var state;
        state = {
            "current_statement": this.current_statement,
            "variables": this.variables
        };
        var json;
        json = json_encode(state);
        if (debug) {
            console.log("saving state " + json + " to " + key + "\r\n\
");
        }
        redis.set(key, json);
    };
    /**
     * @return boolean can continue
     */
    Basic.prototype.interpretStatement = function() {
        if (this.current_statement >= this.statements.length) {
            return false;
        }
        this.statements[this.current_statement].execute();
        this.current_statement++;
        return this.current_statement < this.statements.length;
    };
    /**
     * This function tokenises the source code. Tokenising, or lexing, involves
     * looking through the source code and replacing the syntax with tokens that the
     * parser can read quickly. Each token represents something meaningful to
     * the program, like a variable, operator or string.
     *
     * @param {string} source The source code
     * @return array $tokens The array of tokens
     * @author Jamie Rumbelow
     **/
    Basic.prototype.tokenise = function(source) {
        // Our final array of tokens
        // The current state of our tokeniser
        var state = Basic.S_DEFAULT;
        var token= "";
        var tokens = [];
        // Keep a one-to-one mapping of all the single-character tokens here
        // in an array that we can pull out later.
        var character_tokens;
        character_tokens = {
            "=": Basic.TOKEN_EQUALS,
            "+": Basic.TOKEN_OPERATOR,
            "-": Basic.TOKEN_OPERATOR,
            "*": Basic.TOKEN_OPERATOR,
            "/": Basic.TOKEN_OPERATOR,
            "<": Basic.TOKEN_OPERATOR,
            ">": Basic.TOKEN_OPERATOR,
            "(": Basic.TOKEN_LEFT_PARENTHESIES,
            ")": Basic.TOKEN_RIGHT_PARENTHESIES
        };
        // Scan through each character of the source code at
        // a time and build up a tokenised representation of the source
        var i;
            for (i = 0; i < source.length; i++) {
                // Get the current character
                var char1;
                char1 = source[i];
                // Switch the state
                    switch (state) {
                        /**
                         * The "default" state: routine code parsing. We can use this opportunity
                         * to check for single-char tokens, as well as change state if we need to.
                         */
                        case Basic.S_DEFAULT:
                            // Is our character inside the single character tokens array? If
                            // so, get the token type and add a new token.
                            if (character_tokens[char1]) {
                                tokens.push(new Token(char1, character_tokens[char1]));
                            } else {
                                if (ctype_alpha(char1)) {
                                    token += char1;
                                    state = Basic.S_WORD;
                                } else {
                                    if (is_numeric(char1)) {
                                        token += char1;
                                        state = Basic.S_NUMBER;
                                    } else {
                                        if (char1 == "\"") {
                                            state = Basic.S_STRING;
                                        } else {
                                            if (char1 == "'") {
                                                state = Basic.S_COMMENT;
                                            }
                                        }
                                    }
                                }
                            }
                            break;
                            /**
                             * The "word" state. We check the next character. If it's a letter or digit,
                             * continue the word. If it ends with a colon, it's a label, otherwise it's a word.
                             */
                            /**
                             * The "word" state. We check the next character. If it's a letter or digit,
                             * continue the word. If it ends with a colon, it's a label, otherwise it's a word.
                             */
                        case Basic.S_WORD:
                            // Is our character a letter or digit? If it is, we're continuing the word
                            if (ctype_alnum(char1) || char1 == "_") {
                                token += char1;
                            } else {
                                if (char1 == ":") {
                                    tokens.push(new Token(token, Basic.TOKEN_LABEL));
                                    token = "";
                                    state = Basic.S_DEFAULT;
                                } else {
                                    // Add the token
                                    tokens.push(new Token(token, Basic.TOKEN_WORD));
                                    // Reset the state
                                    token = "";
                                    state = Basic.S_DEFAULT;
                                    // Reprocess the current character in self::S_DEFAULT
                                    i--;
                                }
                            }
                            break;
                            /**
                             * The number state. If the next character is numeric, we're continuing the number.
                             * Otherwise, add the new token.
                             */
                            /**
                             * The number state. If the next character is numeric, we're continuing the number.
                             * Otherwise, add the new token.
                             */
                        case Basic.S_NUMBER:
                            // Is it numeric?
                            if (is_numeric(char1)) {
                                token += char1;
                            } else {
                                // Add the token
                                tokens.push(new Token(token, Basic.TOKEN_NUMBER));
                                // Reset the state
                                token = "";
                                state = Basic.S_DEFAULT;
                                // Reprocess the current character in S_DEFAULT
                                i--;
                            }
                            break;
                            /**
                             * The string state. Any character can be in a string except a quote, so whack it on.
                             */
                            /**
                             * The string state. Any character can be in a string except a quote, so whack it on.
                             */
                        case Basic.S_STRING:
                            // Is it a quote?
                            if (char1 == "\"") {
                                // Add the token
                                tokens.push(new Token(token, Basic.TOKEN_STRING));
                                // Reset the state
                                token = "";
                                state = Basic.S_DEFAULT;
                            } else {
                                token += char1;
                            }
                            /**
                             * The comment state. Comments are terminated by a newline, so check for that. We're just
                             * ignoring it if it's a comment, because the parser doesn't give a damn.
                             */
                            /**
                             * The comment state. Comments are terminated by a newline, so check for that. We're just
                             * ignoring it if it's a comment, because the parser doesn't give a damn.
                             */
                        case Basic.S_COMMENT:
                            // Is it a newline?
                            if (char1 == "\n") {
                                // Reset the state
                                state = Basic.S_DEFAULT;
                            }
                            break;
                    }
            }
        return tokens;
    };
    Basic.class = 'Basic';
    return Basic;
})();
/**
 * Token represents a single token in the lexer.
 * It's just a simple structure to store data.
 *
 * @package basic
 * @author Jamie Rumbelow
 **/
var Token = (function() {
    function Token(token, type) {
        this.token = null;
        this.type = null;
        this.__construct(token, type);
    }
    Token.prototype.__construct = function(token, type) {
        this.token = token;
        this.type = type;
    };
    Token.prototype.__toString = function() {
        return (this.type).toString() + ": <" + this.token + ">";
    };
    Token.class = 'Token';
    return Token;
})();
/**
 * The parser takes in an array of tokens and generates
 * something called an AST (Abstract Syntax Tree). This is a
 * data structure that contains all the statements and expressions
 * inside the code.
 *
 * One of the reasons we tokenise the code first is that we can keep
 * multiple levels in the AST, whereas the tokeniser is stuck at one level.
 *
 * @package basic
 * @author Jamie Rumbelow
 **/
var Parser = (function() {
    function Parser(that, tokens) {
        this.tokens = [];
        this.statements = [];
        this.labels = [];
        this.that = null;
        this.position = 0;
        this.line = 1;
        this.__construct(that, tokens);
    }
    Parser.TOKEN_WORD = 1;
    Parser.TOKEN_NUMBER = 2;
    Parser.TOKEN_STRING = 3;
    Parser.TOKEN_LABEL = 4;
    Parser.TOKEN_EQUALS = 5;
    Parser.TOKEN_OPERATOR = 6;
    Parser.TOKEN_LEFT_PARENTHESIES = 7;
    Parser.TOKEN_RIGHT_PARENTHESIES = 8;
    Parser.TOKEN_EOF = 9;
    Parser.prototype.__construct = function(that, tokens) {
        this.that = that;
        this.tokens = tokens;
    };
    /**
     * The top level parsing function. This function loops through the
     * tokens and routes over to other methods that handle the language.
     *
     * @return array
     * @author Jamie Rumbelow
     */
    Parser.prototype.parse = function() {
        // Keep track of statements and labels
        // Infinite loop; we'll use $this->position to keep
        // track of when we're done
            while (true) {
                var cur;
                cur = this.current();
                // Is this a label?
                if (this.match(Parser.TOKEN_LABEL)) {
                    // Record this label, linking it to the current index of the
                    // statements. This is so we can route the program flow later
                    this.labels[this.previous().token] = this.statements.length > 0 ? this.statements.length - 1 : 0;
                } else {
                    if (this.match(Parser.TOKEN_WORD, Parser.TOKEN_EQUALS)) {
                        // Create a new assignment statement with the current token text (the variable's name), and
                        // parse the expression
                        this.position++;
                        this.statements.push(new AssignmentStatement(this.that, this.previous(1).token, this.expression()));
                    } else {
                        if (cur && cur.token == "print") {
                            // Parse the expression and create new print statement
                            this.position++;
                            this.statements.push(new PrintStatement(this.expression()));
                        } else {
                            if (cur && cur.token == "input") {
                                // Get the next token (variable name) and create new input statement
                                // We're using next_token() to ensure that the next token is indeed a self::TOKEN_WORD.
                                this.statements.push(new InputStatement(this.next_token(Parser.TOKEN_WORD).token));
                                this.position++;
                                this.position++;
                            } else {
                                if (cur && cur.token == "goto") {
                                    // Similar to above, get the next token (label to go to) and create new goto statement
                                    this.statements.push(new GotoStatement(this.next_token(Parser.TOKEN_WORD).token));
                                    this.position++;
                                    this.position++;
                                } else {
                                    if (cur && cur.token == "if") {
                                        // This is where it gets slightly more complex. We first want to parse an expression,
                                        // which is the condition.
                                        this.position++;
                                        var condition;
                                        condition = this.expression();
                                        // Then we want the label to go to
                                        var label;
                                        label = this.next_token(Parser.TOKEN_WORD).token;
                                        this.position++;
                                        this.position++;
                                        // Create the new statement
                                        this.statements.push(new IfThenStatement(condition, label));
                                    } else {
                                        if (cur && cur.token == "exit") {
                                            // Create new print statement
                                            this.position++;
                                            this.statements.push(new ExitStatement());
                                        } else if (cur && cur.token == "\n") {
                                            // skip empty token
                                            this.position++;
                                            continue;
                                        } else {
                                            break;
                                        }
                                    }
                                }
                            }
                        }
                    }
                }
            }
        // Store the statements and labels in the intepreter
        this.that.statements = this.statements;
        this.that.labels = this.labels;
    };
    /**
     * Get the current token
     *
     * @return Token
     * @author Jamie Rumbelow
     **/
    Parser.prototype.current = function() {
        return this.tokens && this.tokens[this.position] !== null ? this.tokens[this.position] : null;
    };
    /**
     * Get the next token, optionally offset
     *
     * @return Token
     * @author Jamie Rumbelow
     **/
    Parser.prototype.next = function(offset) {
        if (typeof offset == 'undefined') offset = 0;
        return this.tokens[this.position + 1 + offset];
    };
    /**
     * Get the previous token, optionally offset
     *
     * @return Token
     * @author Jamie Rumbelow
     **/
    Parser.prototype.previous = function(offset) {
        if (typeof offset == 'undefined') offset = 0;
        return this.tokens[this.position - 1 - offset];
    };
    /**
     * Get the next token, ensuring it is a specific type
     *
     * @return Token
     * @author Jamie Rumbelow
     **/
    Parser.prototype.next_token = function(type) {
        var token;
        token = this.tokens[this.position + 1];
        // Check the token and type match
        if (token.type == type) {
            return token;
        } else {
            return false;
        }
    };
    /**
     * Get the next token, ensuring it is has a particular word as it's text
     *
     * @return Token
     * @author Jamie Rumbelow
     **/
    Parser.prototype.next_token_word = function(word) {
        var token;
        token = this.tokens[this.position + 1];
        // Check the token and type match
        if (token.token == word) {
            return token;
        } else {
            return false;
        }
    };
    /**
     * Match the current token with $token_one, and the next
     * token with $token_two, if we pass it. Then move to the next token.
     *
     * If one token is passed, will return TRUE or FALSE if the current token matches.
     * If two are passed, BOTH are required to match
     *
     * @param {string} token_one The first token
     * @param {string} | boolean $token_two The second token
     * @return boolean
     * @author Jamie Rumbelow
     */
    Parser.prototype.match = function(token_one, token_two) {
        if (typeof token_two == 'undefined') token_two = false;
        if (!token_two) {
            // Compare and return
            var cur;
            cur = this.current();
            if (cur && cur.type == token_one) {
                // Increment the position
                this.position++;
                return true;
            } else {
                return false;
            }
        } else {
            // Check the first compares with the current
            cur = this.current();
            if (cur && cur.type == token_one) {
                // Check the second compares
                var next;
                next = this.next();
                if (next && next.type == token_two) {
                    // Increment the position
                    this.position++;
                    // And success
                    return true;
                } else {
                    return false;
                }
            } else {
                return false;
            }
        }
    };
    /**
     * Parse an expression. We siphon this off to operator(),
     * as we start at the bottom of the precedence stack and rise up
     * and binary operators (+, -, et cetera) are the lowest.
     *
     * @author Jamie Rumbelow
     **/
    Parser.prototype.expression = function() {
        return this.operator();
    };
    /**
     * Parses a series of binary operator expressions into a single
     * expression. We do this by building the expression bit by bit.
     *
     * @author Jamie Rumbelow
     */
    Parser.prototype.operator = function() {
        // Look up what's to the left
        var expression;
        expression = this.atomic();
        // As long as we have operators, keep building operator expressions
            while (this.match(Parser.TOKEN_OPERATOR) || this.match(Parser.TOKEN_EQUALS)) {
                // Get the operator
                var operator;
                operator = this.previous().token;
                // Look to the right, another atomic
                var right;
                right = this.atomic();
                // Set the expression
                expression = new OperatorExpression(expression, operator, right);
            }
        // Return the final expression
        return expression;
    };
    /**
     * Look for an atomic expression, which is a single literal
     * value such as a string or or a number. It's also possible we've
     * got another expression wrapped in parenthesis.
     *
     * @author Jamie Rumbelow
     **/
    Parser.prototype.atomic = function() {
        // Is it a word? Words reference variables
        if (this.match(Parser.TOKEN_WORD)) {
            return new VariableExpression(this.that, this.previous().token);
        } else {
            if (this.match(Parser.TOKEN_NUMBER)) {
                return new NumberExpression(parseFloat(this.previous().token));
            } else {
                if (this.match(Parser.TOKEN_STRING)) {
                    return new StringExpression(this.previous().token);
                } else {
                    if (this.match(Parser.TOKEN_LEFT_PARENTHESIES)) {
                        // Parse the expression and find the closing parenthesis
                        var expression;
                        expression = this.expression();
                        this.position++;
                        // Return the expression
                        return expression;
                    }
                }
            }
        }
        // Give up & throw an error
        throw new BasicParserException("Couldn't parse expression");
    };
    Parser.class = 'Parser';
    return Parser;
})();
/**
 * The base Statement interface. Statements do stuff when executed
 */
var Statement = (function() {
    function Statement() {
        __INTERFACE_NEW__();
    }
    Statement.prototype.execute = function() {
        __INTERFACE_FUNC__();
    };
    Statement.class = 'Statement';
    return Statement;
})();
/**
 * The base Expression interface. Expressions return values when evaluated
 **/
var Expression = (function() {
    function Expression() {
    }
    Expression.prototype.evaluate = function() {
        __INTERFACE_FUNC__();
    };
    Expression.class = 'Expression';
    return Expression;
})();
/**
 * A "print" statement evaluates an expression, converts the result to a
 * string, and displays it to the user.
 */
var PrintStatement = (function() {
    function PrintStatement(expression) {
        this.__construct(expression);
    }
    PrintStatement.prototype.__construct = function(expression) {
        this.expression = expression;
    };
    PrintStatement.prototype.execute = function() {
        console.log(this.expression.evaluate() + "\n\
");
    };
    PrintStatement.class = 'PrintStatement';
    return PrintStatement;
})(null, [Statement]);
/**
 * A "input" statement gets a line of input from the user and assigns it
 * to a variable.
 */
var InputStatement = (function() {
    function InputStatement(variable) {
        this.__construct(variable);
    }
    InputStatement.prototype.__construct = function(variable) {
        this.variable = variable;
    };
    InputStatement.prototype.execute = function() {
        // this.variables[this.variable] = trim(fgets(fopen("php://stdin", "r")));
        // TODO
    };
    InputStatement.class = 'InputStatement';
    return InputStatement;
})(null, [Statement]);
/**
 * An assignment statement assigns a variable with a value
 */
var AssignmentStatement = (function() {
    function AssignmentStatement(interp, variable, value) {
        this.__construct(interp, variable, value);
    }
    AssignmentStatement.prototype.__construct = function(interp, variable, value) {
        this.variable = variable;
        this.value = value;
        this.interp = interp;
    };
    AssignmentStatement.prototype.execute = function() {
        this.interp.variables[this.variable] = this.value.evaluate();
    };
    AssignmentStatement.class = 'AssignmentStatement';
    return AssignmentStatement;
})(null, [Statement]);
/**
 * A goto statement moves the program execution flow to a labelled point.
 */
var GotoStatement = (function() {
    function GotoStatement(label) {
        this.__construct(label);
    }
    GotoStatement.prototype.__construct = function(label) {
        this.label = label;
    };
    GotoStatement.prototype.execute = function() {
        if (this.labels[this.label]) {
            this.current_statement = parseInt(this.labels[this.label]);
        }
    };
    GotoStatement.class = 'GotoStatement';
    return GotoStatement;
})(null, [Statement]);
/**
 * An if-then statement jumps to
 */
var IfThenStatement = (function() {
    function IfThenStatement(expression, label) {
        this.__construct(expression, label);
    }
    IfThenStatement.prototype.__construct = function(expression, label) {
        this.expression = expression;
        this.label = label;
    };
    IfThenStatement.prototype.execute = function() {
        if (this.expression.evaluate()) {
            var goto;
            goto = new GotoStatement(this.label);
            goto.execute();
        }
    };
    IfThenStatement.class = 'IfThenStatement';
    return IfThenStatement;
})(null, [Statement]);
/**
 * A simple statement to exit program flow
 */
var ExitStatement = (function() {
    function ExitStatement() {
    }
    ExitStatement.prototype.execute = function() {
        throw new Exit();
    };
    ExitStatement.class = 'ExitStatement';
    return ExitStatement;
})(null, [Statement]);
/**
 * A variable expression evaluates to the value of the variable
 */
var VariableExpression = (function() {
    function VariableExpression(interp, variable) {
        this.__construct(interp, variable);
    }
    VariableExpression.prototype.__construct = function(interp, variable) {
        this.interp = interp;
        this.variable = variable;
    };
    VariableExpression.prototype.evaluate = function() {
        if (this.interp.variables[this.variable]) {
            return this.interp.variables[this.variable];
        } else {
            return false;
        }
    };
    VariableExpression.class = 'VariableExpression';
    return VariableExpression;
})(null, [Expression]);
/**
 * A number expression evaluates to a number
 */
var NumberExpression = (function() {
    function NumberExpression(number) {
        this.__construct(number);
    }
    NumberExpression.prototype.__construct = function(number) {
        this.number = number;
    };
    NumberExpression.prototype.evaluate = function() {
        return this.number;
    };
    NumberExpression.class = 'NumberExpression';
    return NumberExpression;
})(null, [Expression]);
/**
 * A string expression evaluates to a string
 */
var StringExpression = (function() {
    function StringExpression(string) {
        this.__construct(string);
    }
    StringExpression.prototype.__construct = function(string) {
        this.string = string;
    };
    StringExpression.prototype.evaluate = function() {
        return this.string;
    };
    StringExpression.class = 'StringExpression';
    return StringExpression;
})(null, [Expression]);
/**
 * An operator expression evaluates two expressions and then operates
 * on them.
 */
var OperatorExpression = (function() {
    function OperatorExpression(left, operator, right) {
        this.__construct(left, operator, right);
    }
    OperatorExpression.prototype.__construct = function(left, operator, right) {
        this.left = left;
        this.operator = operator;
        this.right = right;
    };
    OperatorExpression.prototype.evaluate = function() {
        var left;
        left = this.left.evaluate();
        var right;
        right = this.right.evaluate();
            switch (this.operator) {
                case "=":
                    if (is_string(left)) {
                        return left == (right).toString();
                    } else {
                        return left == parseInt(right);
                    }
                    break;
                case "+":
                    if (is_string(left)) {
                        return left += (right).toString();
                    } else {
                        return left + parseInt(right);
                    }
                    break;
                case "-":
                    return left - right;
                    break;
                case "*":
                    return left * right;
                    break;
                case "/":
                    return left / right;
                    break;
                case "<":
                    return left < right;
                    break;
                case ">":
                    return left > right;
                    break;
            }
        throw new BasicParserException("Unknown operator '" + this.operator + "'");
    };
    OperatorExpression.class = 'OperatorExpression';
    return OperatorExpression;
})(null, [Expression]);
/**
 * A basic parser exception class
 **/
var BasicParserException = (function() {
    function BasicParserException() {
    }
    BasicParserException.class = 'BasicParserException';
    return BasicParserException;
})();

module.exports.basic = new Basic();
